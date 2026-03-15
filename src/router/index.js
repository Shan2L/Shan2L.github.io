import { createRouter, createWebHashHistory } from 'vue-router'
import ItemList from "../pages/item_list.vue"
import AboutMe from "../pages/about_me.vue"
import Recent from "../pages/recent.vue"
import PostContent from "../pages/post_content.vue"

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {path: '/', redirect: "/recent"},
    {path: '/recent', component: Recent},
    {path: '/item_list', component: ItemList},
    {path: '/about_me', component: AboutMe},
    {path: '/postContent', component: PostContent, 
      props: (route) => ({
        fileName: route.query.fileName
      })}
  ],
})

export default router
