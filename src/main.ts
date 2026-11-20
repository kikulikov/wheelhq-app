import { mount } from 'svelte';
import App from './App.svelte';
import { applyRobotsPolicy } from './lib/seo';
import './app.css';

applyRobotsPolicy(window.location.hostname);
document.getElementById('seo-fallback')?.remove();

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

mount(App, { target });
