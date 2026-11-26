<script setup></script>

<template>
  <div class="page">
    <h1>About</h1>

    <section>
      <h2 class="section-label">Now &middot; AMD</h2>
      <p>
        Hi, I am Sylvan Liu, an AI software engineer. I currently work at Advanced Micro Devices,
        Inc. (AMD) as an AI infrastructure engineer. My responsibilities include, but are not limited
        to: optimizing the ROCm Communication Collectives Library (RCCL) and deploying large models on
        Radeon-series GPUs.
      </p>
    </section>

    <section>
      <h2 class="section-label">Before &middot; Innosilicon</h2>
      <p>
        Before AMD, I worked at Innosilicon, a domestic GPU-design company, where I led and designed
        the development of a high-performance computing library named "iFormer", which runs
        LLM-specific operators like fused_add_rms_norm, paged attention, flash attention and so on. I
        designed and built this library from scratch and completed the key operators within one year.
      </p>
    </section>

    <section>
      <h2 class="section-label">Research &middot; NCSU &amp; Oregon State</h2>
      <p>
        In my spare time, I worked as a remote intern at North Carolina State University, supervised
        by <a href="https://dongkuanx27.github.io/">Dongkuan Xu</a>. Together with
        <a href="https://wdong5.github.io/">Wenqian Dong</a>, an assistant professor at Oregon State
        University, and her PhD student, we focused on reducing the intermediate memory peak during
        the inference of large vision models.
      </p>
    </section>

    <section>
      <h2 class="section-label">Internship &middot; Intel Shanghai</h2>
      <p>
        I was also an intern at Intel in Shanghai during my postgraduate studies, in a team within
        CESG. We mainly worked with Alibaba to deliver continuous optimization for their
        recommendation models, and maintained an open-source project named "DeepRec". I optimized one
        of the models by fusing operators to reduce memory access latency, and used Intel's AVX-512
        instructions to improve throughput. I also integrated an auto-tuning matmul operator into
        DeepRec, and built its CI/CD system, covering auto-build, unit tests and performance
        benchmarks.
      </p>
    </section>
  </div>
</template>

<style scoped>
h1 {
  margin: 0 0 48px;
  font-family: var(--serif);
  font-size: 36px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--heading);
}

section {
  margin-bottom: 40px;
}

p {
  margin: 0;
}

a {
  color: var(--heading);
  text-decoration: underline;
  text-decoration-color: var(--border);
  text-underline-offset: 3px;
  transition: text-decoration-color 200ms ease;
}

a:hover {
  text-decoration-color: currentColor;
}
</style>
