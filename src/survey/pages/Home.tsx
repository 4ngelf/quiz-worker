import "./Home.css";

const Home = () => {
  return (
    <div class="home-container">
      {/* Main Content */}
      <main class="home-main">
        {/* Hero Section */}
        <div class="home-hero">
          <h2 class="home-hero-title">
            Bienvenido al Sistema de Encuestas
          </h2>
          <p class="home-hero-subtitle">
            Tu opinión es importante para nosotros. Participa en nuestras encuestas y ayúdanos a
            mejorar.
          </p>
        </div>

        {/* Features Section */}
        <div class="features-grid">
          {/* Feature 1 */}
          <div class="feature-card">
            <div class="feature-icon">📝</div>
            <h3 class="feature-title">Rápido y Fácil</h3>
            <p class="feature-description">
              Completa encuestas en pocos minutos desde cualquier dispositivo.
            </p>
          </div>

          {/* Feature 2 */}
          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3 class="feature-title">Seguro y Privado</h3>
            <p class="feature-description">
              Tus datos están protegidos y se utilizan únicamente según la política de privacidad.
            </p>
          </div>

          {/* Feature 3 */}
          <div class="feature-card">
            <div class="feature-icon">✨</div>
            <h3 class="feature-title">Valoramos tu Opinión</h3>
            <p class="feature-description">
              Cada respuesta nos ayuda a entender mejor tus necesidades y preferencias.
            </p>
          </div>
        </div>

        {/* Info Section */}
        <div class="info-section">
          <h3 class="info-title">¿Cómo funciona?</h3>
          <ol class="info-list">
            <li class="info-item">
              <span class="info-number">1</span>
              <span>Haz clic en "Comenzar Encuesta" para acceder a la encuesta disponible.</span>
            </li>
            <li class="info-item">
              <span class="info-number">2</span>
              <span>Responde todas las preguntas de manera honesta y cuidadosa.</span>
            </li>
            <li class="info-item">
              <span class="info-number">3</span>
              <span>Envía tus respuestas y recibe confirmación de que fueron guardadas.</span>
            </li>
            <li class="info-item">
              <span class="info-number">4</span>
              <span>¡Listo! Tu participación ha sido registrada exitosamente.</span>
            </li>
          </ol>
        </div>
      </main>

      {/* Footer */}
      <footer class="home-footer">
        <p class="home-footer-text">
          © 2026 Sistema de Encuestas. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
};

export default Home;
