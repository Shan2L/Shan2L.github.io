const e=`---
title: "Low-Cost End-to-End Inference Optimization with Coding Agents"
date: 2026-11-26 12:00
---

> **Abstract.** Coding agents can now carry out most of the mechanical work of GPU inference optimization: profiling, writing kernels, integrating changes and running validation. Left alone on a long optimization task, however, they tend to trust bad measurements, stop exploring too early and lose track of constraints that live outside their context window, and every one of those mistakes is billed by the token. This article puts two decompositions side by side: the standard end-to-end optimization loop, and the way an agent actually works. From the mismatch between the two it derives four kinds of problems and four kinds of fixes (code-enforced gates, expert tools, human questions and human decisions), illustrated with cases from real optimization work. It then explains how agent usage is billed and gives four levers for spending less. Project, customer and hardware specifics are omitted; numbers are kept as ratios and method-level findings.

## 1. Introduction

Model inference optimization is full-stack work. A single end-to-end speedup may involve a kernel rewrite, an operator fusion in the compute graph, a backend switch in the serving engine, a change to how communication overlaps with compute, and sometimes a change to the algorithm itself. Each layer has its own tools, its own failure modes and its own definition of "correct".

Over the past months I handed most of the execution of this work to coding agents and kept the goals, the evidence and the trade-offs for myself. The agents turned out to be excellent at individual steps and unreliable over long chains, and the cost of that unreliability shows up directly on the bill. The question this article tries to answer is practical: **how do you organize agent-driven optimization so that it stays correct and stays cheap?**

The approach is to decompose two things and then combine them. Section 2 decomposes the optimization loop. Section 3 decomposes the agent: what it is, where its strengths come from and where its weaknesses come from. Section 4 puts the two together, classifies the problems that arise and gives a fix for each class. Section 5 explains the billing model and the levers that reduce spend. The same "decompose, then combine" method applies well beyond optimization, for example to debugging.

## 2. The Optimization Loop

Inference optimization follows the same broad steps as any program optimization. I use six stages: **Define Goal → Observe → Optimize → Integrate → Validate → Deliver**. The middle four repeat until the target is met; if validation shows the target is not reached, the loop returns to Observe to find the next bottleneck. The structure borrows from NVIDIA's APOD cycle (Assess, Parallelize, Optimize, Deploy) [1]. The difference is that goal setting and integration are separate stages: the first decides whether any later number means anything, and the second decides whether a local win survives inside the real system.

### 2.1 Define Goal: sign an optimization contract

Before any measurement, write down a contract with three parts:

- **Scenario**: which device the workload runs on, its power limit and interconnect, and exactly how the baseline is measured.
- **Rules**: which layers of the stack may be changed, and how accuracy is judged (bitwise identity, a numeric threshold, or human review of the output).
- **Close-out**: the budget in time, compute and tokens, and the form of the deliverable: a container image, a feature switch, or upstream pull requests.

Without a contract, a speedup can easily rest on having quietly solved a different problem, or on a silent loss of accuracy. For an agent the contract matters even more, because anything that is not written down is not in its context.

### 2.2 Observe: drill down through four levels

| Level | Typical tools | Question answered |
|---|---|---|
| L1 End to end | Benchmarks, stage timers | Which stage dominates the time |
| L2 System and operators | System profilers, PyTorch Profiler | Multi-GPU behaviour, communication, operator mapping |
| L3 Kernel | Hardware counters, roofline analysis [2] | How far a kernel is from its ceiling |
| L4 Instructions and waves | Instruction-level thread traces | Where the stalls come from |

Modern GPU software stacks provide tools at every level. The discipline is to go top down: locate the largest end-to-end cost and its theoretical ceiling first, and only then decide whether it is worth descending to instruction level. Power and clock telemetry should run across all levels, because on power-limited devices the clock is itself a variable.

### 2.3 Optimize: five levels

Bottlenecks can sit anywhere in the stack, so the fix depends on where they are:

1. **Model and algorithm**: distillation, caching, step skipping, sparsity, quantization; reduces total work.
2. **Parallelism and system**: tensor or sequence parallelism, overlapping communication with compute, weight loading; hides waiting.
3. **Inference engine**: backend selection, chunk and batch sizes, runtime tuning.
4. **Compute graph**: operator fusion, layout changes, removing redundant synchronization; reduces memory traffic.
5. **Kernels and instructions**: tiling, multi-buffering, matrix instructions, hand-written assembly; raises hardware utilization.

The higher the level, the wider the impact and the more likely the change is lossy. The lower the level, the more local the change and the more precise the measurements it needs. Start at the level with the largest expected impact.

### 2.4 Integrate: from the smallest change radius to the largest

Different changes cost very different amounts of integration work. In increasing order: tuning parameters the framework already exposes (environment variables, tuning tables); swapping a backend behind an unchanged interface; fusing two or more operators, which touches the model code; and changing communication or the algorithm, which changes the parallel layout and the control flow. A local gain must be re-measured in the integrated system, and the larger the change radius, the stricter the validation that follows.

### 2.5 Validate and Deliver

A change ships only when it passes five checks:

- **Accuracy**: kernels against the baseline; end to end, compare raw tensors rather than encoded media, since encoders are not deterministic.
- **Performance**: measure the A/A noise floor first, then use interleaved pairs in the same process [3, 4], and confirm the gain reaches end to end.
- **Generality**: held-out inputs, multiple shapes, and the device the workload is actually deployed on.
- **Stability**: repeated runs, concurrent multi-GPU runs, and the full number of inference steps.
- **Regression**: turning the switch off must return exactly to the baseline.

The deliverable is a set of four: a version-pinned image, a switch that can be rolled back, validation evidence bound to the code version, and upstream pull requests for the parts that can be made public. If the target is not met, the loop goes back to Observe.

## 3. What an Agent Is

### 3.1 Scale and the three scaling axes

Since the scaling-law work of 2020 [5], model size has grown steadily. A popular argument at the time compared parameter counts with the roughly 100 trillion synapses of the human brain [6] and suggested that models of that size might approach human-level intelligence. The argument has not aged particularly well, but scale did keep growing: at the time of writing the largest open-weight models are around 2.8 trillion parameters, still about 35 times short of that synapse count.

Research now distinguishes three scaling axes. **Model scaling** and **data scaling** are training-time axes: more parameters and more training tokens [5, 7]. The third, **test-time scaling**, appeared with OpenAI's o1 in 2024 [8]: the weights stay fixed and more compute is spent at inference time, mostly in the form of longer reasoning, to obtain better answers [9].

### 3.2 Strong at single steps, weak at long tasks

On single, well-defined tasks the strongest models from each lab now mostly score between 70% and 97%, on benchmarks such as GPQA Diamond [10], FrontierMath [11], ARC-AGI-2 [12] and agentic tool-use suites, according to Epoch AI's Benchmarking Hub [13]. Knowledge, reasoning, coding and tool use have all improved together.

Long tasks tell a different story. The Remote Labor Index [14] is built from real freelance projects that take human professionals tens of hours each and scores whether the client would accept the result. There the best systems reach only about 41% in the same snapshot [13]. Being strong at single steps does not make an agent strong over a long chain of steps, and an end-to-end optimization is exactly such a chain.

### 3.3 Agent = stateless LLM + local harness

An LLM only continues text: tokens in, tokens out. It cannot open a file or type into a terminal, and it remembers nothing between calls. Everything that makes it an *agent* is done by the **harness** around it (Claude Code, Cursor, OpenAI Codex, VS Code Copilot and so on): reading files, running commands, driving the loop, asking for approvals, spawning sub-tasks, truncating long outputs and compacting the context [15, 16]. The harness moves text by length and format; it understands nothing about GPUs.

### 3.4 From chain of thought to ReAct

The first form of test-time scaling was **chain of thought** [17]: prompting the model to reason explicitly in intermediate steps instead of jumping straight to an answer, which sharply reduced errors on multi-step logic and arithmetic. This is a *reason-only* paradigm. Its weakness is that the model never touches the outside world, so it hallucinates easily, and an early mistake propagates down the whole chain.

Giving the model tools produced the opposite, *act-only* paradigm: call a tool, look at the result, call the next tool. It is grounded in real observations but has no plan; it is easily led by whatever the tools return and loses sight of the original task.

**ReAct** [18] combines the two: reason about what to do next, act through a tool, observe the result, and reason again, until a final answer is reached. Think a step, act a step, observe a step. ReAct is the core of essentially every coding agent in use today.

### 3.5 Later paradigms, and what mainstream tools actually ship

Researchers have proposed many refinements, and each fixes part of the problem while getting stuck somewhere else:

- **Plan-and-Execute** [19] makes a global plan first and then executes it step by step. It works well when dependencies between steps are clear, as when building a software project whose modules and interfaces are known in advance. It does not re-plan when something looks odd but raises no error.
- **Reflexion** [20] lets the model critique and retry its own attempts. Without a reliable ground truth, self-reflection cannot correct mistakes.
- **Tree search** [21] explores several branches and keeps the best. It is unaffordable when a single end-to-end evaluation takes more than ten minutes.
- **Tool making** [22] lets the model write its own tools. Agents can write tools, but they do not know *when* a new tool is needed.

In practice, mainstream coding tools share one design: a single ReAct loop plus a plan mode. The plan mode helps a lot for software development, where tasks and module relationships are usually explicit. On top of that each tool adds its own extension slots: hooks that run custom code at fixed points, sandboxes for isolation, subagents, and parallel worktrees that run N agents on the same task and keep the best result. The execution core, however, is still ReAct.

## 4. Where Agent-Driven Optimization Breaks, and How to Fix It

### 4.1 Four weaknesses, all from how the agent works

| Source | Weakness | Symptom |
|---|---|---|
| ReAct loop | Does not verify its readings | Each observation drives the next step directly |
| Harness | Limited tools | Only generic tools, no domain-specific signals |
| Training | Greedy, short-sighted steps | One slowdown means "this doesn't work"; leads are not followed |
| Context | Cannot see the boundaries | Accuracy standards and data-use rules are not in the window |

The training row deserves a closer look. Whether through supervised fine-tuning or reinforcement-learning post-training, each step is optimized for the locally best action given the current observation; the model has no global view, so it is greedy and short-sighted by construction. Training data also over-represents successful trajectories and filters out the failed explorations that preceded them, which teaches the model to converge early. Recent work on reinforcement learning for reasoning models observes a related effect directly: **policy entropy**, the diversity of actions the model would choose in a given state, collapses early in training, and performance gains are bought with reduced exploration [23]. The model keeps taking the same paths and ends tasks by converging quickly. Anyone who has worked with an agent has seen the result: it tries something once and reports that "this approach probably won't work".

Each of these weaknesses is mild in a single step. Over a long task they compound.

### 4.2 Four kinds of problems, four kinds of fixes

Laying the weaknesses over the optimization loop gives four classes of problems, each with its own fix:

| Kind of problem | Weakness | Fix |
|---|---|---|
| Right and wrong can be decided by a rule | Does not verify readings | **Gates**: enforced by code, not by prompts |
| Generic tools cannot see the issue | Limited tools | **Expert tools**: turn know-how into tools |
| The payoff is not visible in the short term | Greedy steps | **A human question**: decide whether to keep digging |
| The standard lives outside the loop | Cannot see boundaries | **A human decision**: goals, quality and delivery trade-offs |

What remains for the agent is what it does best: following a process step by step, writing scripts, changing code and running validation. With the right gates and tools, even a cheap model can complete the whole loop. The following subsections give one or more cases for each class.

### 4.3 Gates: enforce the rules in code

When a rule has a clear right and wrong answer (a numeric comparison, a threshold, an ordering), enforce it with a script rather than a prompt. Instructions in the prompt are soft constraints: they can be diluted or forgotten as the context grows, and the agent then reports false results or quietly breaks the rules. A gate written in code cannot be forgotten.

The gate itself should be written, or at least specified in detail, by the engineer. An agent asked to build its own gate tends to miss exactly the details that make the gate necessary.

**Case: a fake speedup from measurement order.** While optimizing a large GEMM on a power-limited card, the agent tried a candidate kernel. It measured the default kernel, then the candidate, saw a **1.29×** speedup and was ready to propose an upstream fix. The two measurements had been taken in different states: the first run started cold, and under a power cap the clock keeps drifting as the card heats up. Re-measured with interleaved pairs in the same process (A-B-B-A), the gain shrank to **1.07×**, several shapes were 4%–16% *slower*, and the change was shelved. This is a textbook measurement bias [3]. The ReAct loop has no step that questions a reading, so the agent cannot catch it alone. The fix lives in the measurement tool: it accepts only interleaved pairs, measures the A/A noise floor first and reports only ratios [4].

**More gates from the same work:**

- *Comparing the wrong artifact.* Encoded video differs between runs even when the underlying tensors are identical, so accuracy is gated on raw tensors.
- *Too few steps.* A change passed a 3-step validation and then produced NaN on every full 20-step run. The gate now requires the full step count before anything is called stable.
- *Guessed shapes.* A whole tuning round targeted the wrong matrix dimensions because the shapes were inferred from the model config instead of read from runtime logs. Shapes now come from logs only.
- *Engineering conventions.* Rules such as "check that the device is idle before running" or "never overwrite a running job's script" were turned into automatic checks in the job launcher instead of lines in the prompt.

### 4.4 Expert tools: let the model read evidence, not raw data

The second class of problems has a clear signature: the agent can do the job without help, but it does noticeably better with a purpose-built tool.

**Case: per-microsecond attribution of multi-GPU traces.** A profiler trace of multi-GPU inference is often gigabytes in size, with hundreds of thousands of GPU events; as text it would be on the order of a hundred million tokens. No agent can read that directly. A capable agent will write its own script to compute summary statistics (compute share, top kernels, communication share), and the result is usually reasonable. But an engineer who knows the structure of these traces can encode a much better analysis once and hand it to every future session [24]:

1. **Align clocks.** Put every GPU's timeline on a single clock, then self-check using collectives: the same all-reduce cannot have finished on one GPU while it has not yet started on another.
2. **Match collectives.** Within one communication group, the k-th collective of a step is the same operation on every GPU. Matching uses order only and does not depend on cross-GPU clocks.
3. **Split waiting from transfer.** For each matched collective, the fastest GPU's duration counts as transfer; the extra time on the slower GPUs counts as waiting for peers.
4. **One category per microsecond.** Every microsecond on every GPU is assigned exactly one category: compute, overlap (compute with concurrent communication), waiting, transfer, copy or idle. The categories sum exactly to wall-clock time.

The raw trace never goes to the model. A fixed set of queries runs over it and the agent receives a compact summary with drill-down handles. Confirmed facts are reported separately from possible explanations, so the agent explains what the rules have already computed rather than guessing.

A small experiment shows the effect. The task: find the bottleneck in an 8-GPU diffusion-model inference trace (about 2.3 GB), scored out of 8, with at most 40 tool calls. In this workload one stream computes while two others run an all-gather and an all-to-all concurrently, and both collectives share the same PCIe links. The same inexpensive model ran the task twice:

| Group | Score | Cost (credits) | Time |
|---|---|---|---|
| A: generic tools only (python, jq) | 6.5 / 8 | 2.27 | 7.8 min |
| B: plus the trace drill-down tools | 8 / 8 | 1.27 | 3.2 min |

Both groups found the surface facts: exposed communication is about 72% of the time, and a communication kernel ranks first. Only group B found the mechanism: the weight all-gather and the all-to-all compete for the same bandwidth (the all-to-all takes about 1.1 ms alone and about 7.3 ms under contention), and the all-gathers move about 2.4 TB in total. With the tool, the model saw deeper in less than half the time and at about half the cost. (N = 1; the numbers are illustrative, not a benchmark.)

The broader point is that once expert knowledge lives in a tool, the result depends much less on the model's own ability, and a cheaper, less capable model can reach the same quality. Section 5 returns to what this means for cost.

**Case: how far four implementations of one kernel are from assembly.** The same tool-first approach works at instruction level. I implemented one attention kernel of a video model in HIP, FlyDSL and Triton, each trying to match a hand-written assembly (ASM) version. All four produce bitwise-identical output and were measured as alternating pairs in the same process:

- The languages that can express the software-pipelining design in the assembly (HIP and FlyDSL) reach about **98%** of ASM performance.
- The language that cannot express it (Triton) stops at about **84%** even after full tuning.

The gap can be decomposed by source:

| Source of the gap | Who can fix it | Size |
|---|---|---|
| Pipeline design in the assembly | Language trade-off; a human call | About 18–20 points once expressible |
| Backend code-generation defects (dead instructions, FP8 conversion emulated in software) | Compiler | 1% up to tens of points |
| Wrong declarations by the author (alignment declared larger than real) | Coding discipline | About 1% |
| Default policies and parameters (loop alignment, scheduling strategy) | Changeable defaults | 0.3% up to tens of points |
| Scheduler cost model | Compiler | The remaining ~2% |

The workflow runs in two directions. When *optimizing*, drill from the top down and edit the assembly based on instruction-level traces. When studying *portability*, go the other way: start from the assembly and find the highest-level language that still gets close to it. The gap between each level and the assembly is what that level's compiler could still contribute. But higher-level languages trade performance for productivity on purpose; whether a given gap is worth closing, and whether closing it fits the language's design philosophy, remains a human judgment.

### 4.5 A human question: "why?"

Tools have blind spots too, and some problems need exploration that the agent will not start on its own.

**Case: young waves that cannot get an issue slot.** An attention kernel already had a two-stage pipeline: global-memory prefetch overlapped with compute through double buffering. The instruction-level trace showed barrier waits at **42%** of the time. Reasoning from experience, the agent concluded that double buffering did not leave enough slack and implemented triple buffering. It came out slower. Fewer synchronizations and staggered waves did not help either, and the agent concluded that the kernel was at its limit and the remaining headroom was below 1%.

I asked one question: *why do methods that normally work not work here? If it truly cannot be improved, I want to know why.* The agent went back to the hardware documentation and changed its point of view: it wrote a script that split the waiting time per wave instead of per kernel. The four resident waves waited 1120, 712, 577 and 184 cycles respectively. The distribution was extremely uneven and ordered by wave age, a fact the aggregated view had averaged away.

The mechanism: the whole point of keeping several waves resident is that they overlap and hide each other's memory latency. But the instruction issue arbitration favoured the oldest wave, a well-known property of oldest-first warp scheduling [25]. The oldest wave ran ahead and then sat idle at the barrier, while the youngest starved for issue slots. Four waves were supposed to hide each other's latency; effectively only three did, which amounted to a hidden loss of occupancy and left issue slots idle. The agent then implemented its own fix: raise each wave's scheduling priority according to its progress, so that all waves advance together. Issue-slot utilization rose visibly; combined with the triple buffering that had looked useless before, the kernel became **about 5% faster (4.7%)**, with bitwise-identical output.

**Why one question works.** Section 4.1 explained why agents converge too early. Complex work such as optimization or debugging needs the opposite: the answer is rarely a direct application of known experience, so the right shape is to **diverge first and converge later**: try many things, collect every clue that might matter, then narrow down to the root cause. Agents lean toward convergence at every step.

There are system-level answers to this. AlphaEvolve [26] uses separate models to generate many program variants and an evaluator to select the most promising ones for deeper search, which builds divergence into the system. Another common approach is a **knowledge base** of past pitfalls and proven techniques, so that the next session facing the same situation starts from what already worked instead of repeating the trial and error.

For an individual engineer the simplest tool is to keep asking. When the agent says something cannot be done, ask why, which directions have not been tried and which clues still look suspicious. That one question does three things:

- **Permission.** It authorizes further digging and grants an exploration budget. The agent was not missing ability; it was missing a signal to keep going.
- **Process reward.** It rewards the act of digging itself, compensating for the sparse outcome feedback of long tasks. It is the run-time counterpart of rewarding good intermediate steps rather than only final answers [27, 28].
- **A low bar.** The person asking does not need to know the answer, only to notice that something is odd.

**One sentence can also be a stop signal.** The agent once wanted to interleave matrix instructions into the softmax to "hide" its cost. Knowing that matrix and vector instructions compete for the same issue resources on this hardware, I said it would not be faster; measurement showed the moved version was 6%–11% slower, and a whole class of attempts was pruned. Another time, 2:4 structured sparsity in attention saved a few seconds per inference step and the agent wanted to push on. The error varied with the input in ways no fixed threshold could bound, so I judged the risk uncontrollable and dropped it early.

### 4.6 A human decision: peak performance or broad compatibility

The last class of problems cannot be delegated at all.

Optimization work usually has two outlets. One is a **specific deployment**, which wants peak performance and can accept deep cross-module fusion or a custom communication module. The other is **upstream open source**, which has to serve many models with one framework (one size fits all). Upstream frameworks need layers of abstraction to stay compatible, so to some extent they trade performance for generality. A change that is ideal for one deployment may be unacceptable upstream, and an upstream-friendly change may give away part of the gain.

Doing every optimization twice, once in each style, is rarely affordable. In practice the work is done for the deployment, and a suitable subset is selected for upstream contribution along the way. Which subset, and how much performance to give up for it, depends on business goals, maintenance capacity and the community's roadmap. An automated loop scores only the local gain; integration and maintenance costs are not in its score. A human has to make this trade-off.

The same holds for several other decisions:

- **Guarding the goal.** When the agent proposes "switch to a distilled variant with fewer steps and we meet the target", a human has to point out that this changes the problem rather than solving it.
- **Judging quality.** Whether a lossy optimization is acceptable is decided by looking at the output, against the standard agreed in the contract.
- **Irreversible external actions.** Publishing code or results, opening pull requests, and deciding which data may be shown to an AI service, or which parts of a deliverable may be disclosed and which must be kept private, are decisions engineers have to make themselves.

## 5. Where the Money Goes

Humans have to stay in the loop, and every interaction with the agent is billed. To spend well, it helps to know how.

### 5.1 The mechanism: the whole prefix is resent every turn

The model is stateless, so every request carries the entire context: the system prompt, skill definitions, project instructions, a description of the machine and environment, open files, cross-session memory, the definitions of every enabled tool, the conversation so far and finally the new message. The first request of a session reaches the provider with nothing cached and is billed at the full input price. Later requests share a long, unchanged prefix with the previous one; the provider keeps that prefix's attention key-value state cached, and the cached portion is billed at a small fraction of the price [29, 30]. Output is the most expensive part.

For the main model I used, the unit prices of cached input, uncached input and output stood at roughly **1 : 25 : 100**. Two consequences follow. Short sessions are expensive because of output. Long sessions are expensive because of cold starts: when the cache is lost, hundreds of thousands of tokens of context are written again at 25 times the cached price.

### 5.2 Observations from my own billing logs

I analysed about 4,800 of my own requests over 8 days. **Cold requests were only 7.8% of main-agent requests but took 59% of the budget**, and 65 of the 83 cold requests came right after I had paused. How you interact decides the bill.

| Observation | Numbers |
|---|---|
| The cache expires after about 300 s of inactivity | Median cache hit rate 99% → 5% |
| Switching models (or reasoning-effort levels) mid-session | Hit rate dropped to zero in 11 of 11 cases |
| Some models with a single input above 272K tokens | The whole request is billed at the long-context price |
| Subagents receive all tool definitions by default | They start at 50k–93k tokens; about 21k with only the needed tools |
| Different tokenizers | The same text costs about 50% more tokens on some models |
| Resuming an idle long session vs starting a new one | About 198 vs 26 credits per turn |
| Writing memory files mid-session | Does not break the cache |

The cache lifetime exists because key-value state occupies scarce accelerator memory [30]; when the request goes to a different model or configuration it is served by a different cluster and nothing can be reused.

### 5.3 Cost = turns × cost per turn: four levers

**R · Pruning and gates → fewer turns.** The cheapest session is the one you do not run; the most expensive is the one that runs for nothing. Refuse approaches that cannot meet the delivery standard. Keep a rejection list of "tried, and why it didn't work" so that the same pitfall is never paid for twice. Estimate an approach's ceiling before implementing it; if the ceiling cannot reach the target, the work is wasted by construction. Let a human stop high-risk directions early. The wasted sessions in Section 4.3 (guessed shapes, cold-versus-hot measurements, a 3-step validation followed by NaN at 20 steps) can all be caught the first time by gates, which return a single line of verdict to the agent instead of a long investigation.

**T · Expert tools → less output and a cheaper model tier.** Moving expert knowledge into tools reduces the dependence on the most capable, most expensive models. Writing a complex analysis script is also costly in itself, because output is the most expensive token class. On the same trace-analysis task, an expensive model with generic tools cost 243 credits, while an inexpensive model with the drill-down tools reached the same full score for 1.27, **about 190 times cheaper**.

**C · Context control → less input per turn.** Every extra thousand tokens of context is paid again on every turn. In one measured session, tool definitions took 49% of the context, the first message (memory and environment) 23% and the history 21%. So: enable only the tools the task needs; keep only an index in memory and let the agent follow it to the details when needed; trim tool output with grep, tail or jq, or fetch it on demand; and start a new session after each milestone.

**O · Orchestration → lower unit price.** Let the expensive model decompose the task, dispatch work and make judgments. Send search and log reading to the cheapest tier, and terminal work and code changes to the cheapest tier that can do them reliably. Subagents run as separate processes and return only a summary to the main agent. Always specify the subagent's model: without it, the subagent inherits the main model, which in my logs meant about 201 instead of 3.9 credits per run.

### 5.4 Three habits

1. **Reply within five minutes.** If you need to step away, have the agent write its progress to a file first; when you return, start a new session and continue from the file.
2. **Don't switch models in the main session.** Send side tasks to a subagent with a cheap model instead.
3. **Contract first.** State the target device, accuracy tolerance, forbidden techniques and rejection list in one message before work starts. Not running in the wrong direction is the largest saving of all.

## 6. Conclusion

The method in this article is simple: decompose the workflow, decompose the agent, and look at where the two do not fit. The mismatches fall into four classes, and each has its own fix. Rules that can be checked go into code-enforced gates. Expert knowledge goes into tools, which also lets cheaper models do the work. Exploration that the agent will not start by itself is unlocked by a human asking "why?". Decisions about goals, quality, disclosure and the balance between peak performance and upstream compatibility stay with a human.

**The human is the catalyst who points the budget in the right direction**: authorizing a deeper dig when something is odd, stopping with one sentence when there is no hope, and weighing a specific deployment against community compatibility. **Agent engineering makes every step cheaper**: gates and pruning cut the number of turns, tools cut output and the model tier, context control cuts input, and orchestration keeps the expensive model for judgment.

Humans decide where the tokens go; engineering decides how much each token costs.

---

## References

1. NVIDIA. *CUDA C++ Best Practices Guide*, "Assess, Parallelize, Optimize, Deploy". https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/
2. S. Williams, A. Waterman, D. Patterson. "Roofline: An Insightful Visual Performance Model for Multicore Architectures". *Communications of the ACM* 52(4), 2009.
3. T. Mytkowicz, A. Diwan, M. Hauswirth, P. F. Sweeney. "Producing Wrong Data Without Doing Anything Obviously Wrong!". *ASPLOS*, 2009.
4. T. Kalibera, R. Jones. "Rigorous Benchmarking in Reasonable Time". *ISMM*, 2013.
5. J. Kaplan et al. "Scaling Laws for Neural Language Models". arXiv:2001.08361, 2020.
6. D. A. Drachman. "Do we have brain to spare?". *Neurology* 64(12), 2005.
7. J. Hoffmann et al. "Training Compute-Optimal Large Language Models". *NeurIPS*, 2022. arXiv:2203.15556.
8. OpenAI. "Learning to Reason with LLMs". 2024. https://openai.com/index/learning-to-reason-with-llms/
9. C. Snell, J. Lee, K. Xu, A. Kumar. "Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters". arXiv:2408.03314, 2024.
10. D. Rein et al. "GPQA: A Graduate-Level Google-Proof Q&A Benchmark". arXiv:2311.12022, 2023.
11. E. Glazer et al. "FrontierMath: A Benchmark for Evaluating Advanced Mathematical Reasoning in AI". arXiv:2411.04872, 2024.
12. F. Chollet et al. "ARC-AGI-2: A New Challenge for Frontier AI Reasoning Systems". arXiv:2505.11831, 2025.
13. Epoch AI. *Benchmarking Hub* (CC BY 4.0), accessed November 2026. https://epoch.ai/benchmarks
14. M. Mazeika et al. "Remote Labor Index: Measuring AI Automation of Remote Work". arXiv:2510.26787, 2025.
15. L. Weng. "LLM Powered Autonomous Agents". 2023. https://lilianweng.github.io/posts/2023-06-23-agent/
16. OpenAI. "Unrolling the Codex agent loop". 2026.
17. J. Wei et al. "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models". *NeurIPS*, 2022. arXiv:2201.11903.
18. S. Yao et al. "ReAct: Synergizing Reasoning and Acting in Language Models". *ICLR*, 2023. arXiv:2210.03629.
19. L. Wang et al. "Plan-and-Solve Prompting: Improving Zero-Shot Chain-of-Thought Reasoning by Large Language Models". *ACL*, 2023. arXiv:2305.04091.
20. N. Shinn et al. "Reflexion: Language Agents with Verbal Reinforcement Learning". *NeurIPS*, 2023. arXiv:2303.11366.
21. S. Yao et al. "Tree of Thoughts: Deliberate Problem Solving with Large Language Models". *NeurIPS*, 2023. arXiv:2305.10601.
22. T. Cai et al. "Large Language Models as Tool Makers". *ICLR*, 2024. arXiv:2305.17126.
23. G. Cui et al. "The Entropy Mechanism of Reinforcement Learning for Reasoning Language Models". arXiv:2505.22617, 2025.
24. Meta. *Holistic Trace Analysis*. https://github.com/facebookresearch/HolisticTraceAnalysis
25. T. G. Rogers, M. O'Connor, T. M. Aamodt. "Cache-Conscious Wavefront Scheduling". *MICRO*, 2012.
26. A. Novikov et al. "AlphaEvolve: A Coding Agent for Scientific and Algorithmic Discovery". Google DeepMind, 2025. arXiv:2506.13131.
27. L. Ouyang et al. "Training Language Models to Follow Instructions with Human Feedback". *NeurIPS*, 2022. arXiv:2203.02155.
28. H. Lightman et al. "Let's Verify Step by Step". *ICLR*, 2024. arXiv:2305.20050.
29. Anthropic. "Prompt caching". https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
30. W. Kwon et al. "Efficient Memory Management for Large Language Model Serving with PagedAttention". *SOSP*, 2023. arXiv:2309.06180.
`;export{e as default};
