const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');
const { EMAIL_TEMPLATES } = require('../utils/constants');

// Template cache
const templateCache = new Map();

// Helper functions for Handlebars
handlebars.registerHelper('formatCurrency', (amount) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount);
});

handlebars.registerHelper('formatDate', (date) => {
  return new Date(date).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

handlebars.registerHelper('eq', (a, b) => a === b);
handlebars.registerHelper('gt', (a, b) => a > b);
handlebars.registerHelper('lt', (a, b) => a < b);

const loadTemplate = async (templateName) => {
  try {
    // Check cache first
    if (templateCache.has(templateName)) {
      return templateCache.get(templateName);
    }

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      `${templateName}.hbs`
    );

    try {
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateContent);

      // Cache the compiled template
      templateCache.set(templateName, compiledTemplate);

      logger.info(`Template loaded and cached: ${templateName}`);
      return compiledTemplate;
    } catch (fileError) {
      if (fileError.code === 'ENOENT') {
        logger.warn(`Template file not found: ${templateName}, using fallback`);
        return getFallbackTemplate(templateName);
      }
      throw fileError;
    }
  } catch (error) {
    logger.error(`Error loading template ${templateName}:`, error);
    throw error;
  }
};

const getFallbackTemplate = (templateName) => {
  const fallbackTemplates = {
    welcome: handlebars.compile(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">¡Bienvenido {{firstName}}!</h1>
        <p>Gracias por registrarte en nuestra plataforma de e-commerce.</p>
        <p>Tu cuenta ha sido creada exitosamente.</p>
        <a href="{{loginUrl}}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Iniciar Sesión</a>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">
          Si tienes alguna pregunta, no dudes en contactarnos.
        </p>
      </div>
    `),

    'order-confirmation': handlebars.compile(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">¡Gracias por tu pedido!</h1>
        <p>Hola {{firstName}},</p>
        <p>Tu pedido <strong>#{{orderId}}</strong> ha sido confirmado.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">Detalles del pedido:</h2>
          {{#each items}}
          <div style="border-bottom: 1px solid #e5e7eb; padding: 10px 0;">
            <p><strong>{{productName}}</strong></p>
            <p>Cantidad: {{quantity}} - {{formatCurrency price}}</p>
            <p>Total: {{formatCurrency total}}</p>
          </div>
          {{/each}}
          <div style="margin-top: 15px; font-size: 18px;">
            <strong>Total del pedido: {{formatCurrency total}}</strong>
          </div>
        </div>
        
        <p>Te notificaremos cuando tu pedido sea enviado.</p>
        <a href="{{trackingUrl}}" style="background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Pedido</a>
      </div>
    `),

    'order-shipped': handlebars.compile(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #DC2626;">¡Tu pedido está en camino! 📦</h1>
        <p>Hola {{firstName}},</p>
        <p>Tu pedido <strong>#{{orderId}}</strong> ha sido enviado.</p>
        
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número de seguimiento:</strong> {{trackingNumber}}</p>
          <p><strong>Entrega estimada:</strong> {{estimatedDelivery}}</p>
        </div>
        
        <a href="{{trackingUrl}}" style="background-color: #DC2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Rastrear Pedido</a>
      </div>
    `),

    'admin-alert': handlebars.compile(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #EF4444;">🚨 Alerta del Sistema</h1>
        <p><strong>Tipo de alerta:</strong> {{alertType}}</p>
        <p><strong>Mensaje:</strong> {{message}}</p>
        <p><strong>Timestamp:</strong> {{timestamp}}</p>
        
        {{#if data}}
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3>Datos adicionales:</h3>
          <pre style="white-space: pre-wrap; font-size: 12px;">{{data}}</pre>
        </div>
        {{/if}}
        
        <a href="{{dashboardUrl}}" style="background-color: #EF4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Dashboard</a>
      </div>
    `),
  };

  return (
    fallbackTemplates[templateName] ||
    handlebars.compile(`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Notificación</h1>
      <p>Template no encontrado: {{templateName}}</p>
      <p>Contenido: {{content}}</p>
    </div>
  `)
  );
};

const renderTemplate = async (templateName, data) => {
  try {
    const template = await loadTemplate(templateName);
    const html = template(data);

    logger.info(`Template rendered: ${templateName}`, {
      templateName,
      dataKeys: Object.keys(data),
    });

    return html;
  } catch (error) {
    logger.error(`Error rendering template ${templateName}:`, error);

    // Fallback to simple HTML
    const fallbackHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Notificación</h1>
        <p>Error al procesar la plantilla.</p>
        <p>Datos: ${JSON.stringify(data, null, 2)}</p>
      </div>
    `;

    return fallbackHtml;
  }
};

const getAvailableTemplates = () => {
  return Object.values(EMAIL_TEMPLATES);
};

const clearTemplateCache = () => {
  templateCache.clear();
  logger.info('Template cache cleared');
};

const preloadTemplates = async () => {
  try {
    const templates = Object.values(EMAIL_TEMPLATES);
    const loadPromises = templates.map((templateName) =>
      loadTemplate(templateName)
    );

    await Promise.allSettled(loadPromises);

    logger.info(`Preloaded ${templates.length} templates`, {
      templates,
      cacheSize: templateCache.size,
    });
  } catch (error) {
    logger.error('Error preloading templates:', error);
  }
};

module.exports = {
  loadTemplate,
  renderTemplate,
  getAvailableTemplates,
  clearTemplateCache,
  preloadTemplates,
};
