<script setup>
import { computed } from 'vue'

// 匹配 posts 目录下所有 .md 文件（包括子目录）
const modules = import.meta.glob('../posts/**/*.md',
    {
        eager: true,
    }
)

// 处理文件列表，生成标题和链接
const articles = computed(() => {
  const allArticles = Object.entries(modules).map(([filePath, module]) => {
    // 提取文件名（不含扩展名）作为标题，或者从模块的 frontmatter 中获取
    // const fileName = filePath.split('/').pop().replace(/\.md$/, '')
    const fileName = filePath.split('/').pop()
    // 生成路由链接（假设文章详情页路径为 /post/文件名）
    // 如果模块有导出 title 属性（例如通过 frontmatter 解析），则使用它
    const title = module.attributes?.title || fileName
    const date = module.attributes?.date
    return {fileName, title, date}
  })

  console.log(allArticles[0].date)
    const sorted = allArticles
    .filter(item => item.date)
    .sort((a, b) => new DataTransfer(b.data) - new Date(a.data))

    // console.log(sorted)
    
    return sorted.slice(0, 10)
})

</script>

<template>
<div id=body>
<div id=intro>
    
    <p style="line-height: 1.5;">
    <text style="font-size: 200%;">Hi</text>
    <text>, I am Sylvan Liu, an AI software engineer currently working at AMD as an AI infrastructure engineer, 
            focusing on optimizing communication libraries and deploying large models on GPUs. Previously, 
            I led the development of a high-performance computing library at Innosilicon, a domestic GPU company, 
            implementing key operators for large language models. I have also collaborated with academic researchers 
            from North Carolina State University and Oregon State University on memory optimization for large vision models, 
            and interned at Intel Shanghai, where I contributed to recommendation model optimizations and CI/CD systems for 
            an open-source project.
    </text>
    </p>
</div>

<div>
    <h2> Recent Articles</h2>

    <ul>
        <li v-for="article in articles" :key="article.link" class="li_wrapper">
            <router-link :to="{ path: '/postContent', query: {fileName: article.fileName}}">
                {{article.title }}
            </router-link>
        </li>
    </ul>
</div>

</div>
</template>

<style scoped>

#body{
    margin-left: 10%;
    margin-right: 10%;
    margin-top: 5%;
    margin-bottom: 5%;
}

#intro{

    text-align: justify;
}


.li_wrapper{
    margin-top: 2%;
    margin-bottom: 2%;
}

</style>

