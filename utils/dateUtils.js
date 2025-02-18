export function getCurrentDate() {
    return new Date().toLocaleDateString('es-CR', {
      timeZone: 'America/Costa_Rica',
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    });
  }