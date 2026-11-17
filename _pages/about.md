---
layout: aql
title: Home
permalink: /
---

<section class="hero">
  <div>
    <h1>{{ site.data.aql_home.heading | escape }}</h1>
    <p>{{ site.data.aql_home.intro | escape }}</p>
  </div>
</section>

<section class="home-posts" aria-labelledby="posts-title">
  <h2 id="posts-title" class="section-heading">{{ site.data.aql_home.posts_heading | escape }}</h2>
  {% include aql-post-list.html %}
</section>
