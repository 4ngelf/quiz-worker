//# imports

import { For, type ParentProps } from "solid-js";

//# Assets

import "./Home.css";

//# Components

const Home = () => (
  <div class="home-container">
    <main class="home-main">
      <HeroSection />
      <FeaturesSection />
      <InfoSection />
    </main>
  </div>
);

const HeroSection = () => (
  <div class="home-hero">
    <h1 class="home-hero-title">
      Bienvenido al Sistema de Encuestas
    </h1>
    <p class="home-hero-subtitle">
      Tu opinión es importante para nosotros. Participa en nuestras encuestas y ayúdanos a mejorar.
    </p>
  </div>
);

const FeaturesSection = () => {
  const FeatureCard = (props: { icon: string; title: string } & ParentProps) => (
    <div class="feature-card container-box">
      <div class="feature-card-icon">{props.icon}</div>
      <h2 class="feature-card-title">{props.title}</h2>
      <p class="feature-card-description">{props.children}</p>
    </div>
  );

  return (
    <div class="features">
      {/* Feature 1 */}
      <FeatureCard icon="📝" title="Rápido y Fácil">
        Completa encuestas en pocos minutos desde cualquier dispositivo.
      </FeatureCard>
      <FeatureCard icon="🔒" title="Seguro y Privado">
        Tus datos están protegidos y se utilizan únicamente según la política de privacidad.
      </FeatureCard>
      <FeatureCard icon="✨" title="Valoramos tu Opinión">
        Cada respuesta nos ayuda a entender mejor tus necesidades y preferencias.
      </FeatureCard>
    </div>
  );
};

const InfoSection = () => {
  const items = [
    "Responde todas las preguntas de manera honesta y cuidadosa.",
    "Envía tus respuestas.",
    "¡Listo! Tu participación sera registrada exitosamente.",
  ];
  return (
    <div class="container-box">
      <h3 class="info-section-title">¿Cómo funciona?</h3>
      <ol class="info-section-list">
        <For each={items}>
          {(text, index) => (
            <li class="info-section-list-item">
              <span class="info-section-list-item-number">{index() + 1}</span>
              <span class="info-section-list-item-text">{text}</span>
            </li>
          )}
        </For>
      </ol>
    </div>
  );
};

export default Home;
