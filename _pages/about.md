---
layout: aql
title: Home
permalink: /
---

<section class="hero">
  <div>
    <h1>{{ site.data.aql_home.heading | escape }}</h1>
    <p class="hero-intro">{{ site.data.aql_home.intro | escape }}</p>
    {% if site.data.aql_home.credentials and site.data.aql_home.credentials != empty %}
      <p class="hero-credentials">{{ site.data.aql_home.credentials | escape }}</p>
    {% endif %}
  </div>
  <figure class="neuron" hidden>
    <canvas tabindex="0" aria-label="Rotatable 3D neuron" aria-describedby="neuron-help"></canvas>
    <figcaption>
      <span id="neuron-help">Drag to rotate.<span class="sr-only"> You can also use the arrow keys.</span></span>
      <button class="neuron-signal" type="button">Send a signal <span aria-hidden="true">↗</span></button>
    </figcaption>
  </figure>
</section>

<script src="{{ '/assets/js/aql-neuron.js' | relative_url }}" defer></script>

<section class="home-posts" aria-labelledby="posts-title">
  <h2 id="posts-title" class="section-heading">{{ site.data.aql_home.posts_heading | escape }}</h2>
  {% include aql-post-list.html %}
</section>
