import "./Success.css";

const Success = () => {
  return (
    <div class="success-container">
      <div class="success-card">
        {/* Success Icon */}
        <div class="success-icon-wrapper">
          <svg
            class="success-icon"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
        </div>

        {/* Congratulatory Text */}
        <h1 class="success-title">¡Gracias!</h1>

        <p class="success-subtitle">
          Felicidades por completar la encuesta.
        </p>

        <p class="success-message">
          Tu respuesta ha sido enviada exitosamente al servidor. Apreciamos mucho tu participación y valiosa contribución.
        </p>

        {/* Footer Text */}
        <p class="success-footer">
          Puedes cerrar esta ventana.
        </p>
      </div>
    </div>
  );
};

export default Success;
