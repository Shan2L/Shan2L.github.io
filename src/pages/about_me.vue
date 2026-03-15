<script setup></script>

<template>
    <div id="intro">
        <div>
        Hi, I am Sylvan Liu, an AI software engineer. I currently worked at Advanced Micro Devices,Inc (AMD)
        as an AI infrastructrue engineer. My responsibities include but are not limited to: optimize Rocm Communication
        Collective Library(RCCL), deploy Large Models on Radeon-series GPU.
        </div>

        <br/><br/>

        <div>
        Before AMD, I have worked at Innosilicon, which is a domestic GPU-design company, I lead, design the mainly take
        part in the development of high-performance computing library named "iFormer", which is used to run LLM-specific operators
        like fused_add_rms_norm, paged attention, flash attention and so on. I design and build this library from scratch and
        use 1 year to complete implementation of the key operators.
        </div>

        <br/><br/>

        <div>
        During the spare time of my work, I worked as an remote intern at North Carolina State University. I was supervised by 
        <a href="https://dongkuanx27.github.io/"> Dongkuan Xu</a>, we worked with an AP from Oregon State University <a href="https://wdong5.github.io/">Wenqian Dong</a>
        and her Phd student to focus on reduce the intermediate momery bottleneck peak during the inference of Large Vision Model.
        </div>

        <br/><br/>

        <div>
        I have also been an intern of Intel, Inc at Shanghai when I was a post gradate student. I work at a team in CESG.
        We mainly worked with Alibaba to deliver continous optimization for their recommendation models, and we also have a open-source
        project name "DeepRec". I optimized one of the model by fusing them to reduce the memory access latency, we also use
        Intel's AVX512 instruction to improve the throughput. Besides, I have integrate a auto-tunning matmul operator to DeepRec.
        During my spare time, I build the CI/CD system for DeepRec, which contrains auto-build, unit-test, performance benchmark et.al.
        </div>
    </div>
</template>

<style scoped>
#intro{
    margin-left: 10%;
    margin-right: 10%;
    margin-top: 5%;
    margin-bottom: 5%;
    text-align: justify;
}
</style>
