<script setup></script>

<template>
  <div id="title">
    <h1>
      Sylvan's Site
    </h1>
  </div>

  <div id="navi">
    <div><router-link to="/recent">Recent</router-link></div>
    <div>|</div>
    <div><router-link to="/item_list">Blog</router-link></div>
    <div>|</div>
    <div><router-link to="/about_me">AboutMe</router-link></div>
  </div>
  <hr/>

  <router-view/>

</template>

<style scoped>

#title{
    text-align: center;
    margin-top: 5%;
}

#navi{
  justify-content:center;
  display: flex;
}

#navi div{
  margin: 1%;
}

</style>
