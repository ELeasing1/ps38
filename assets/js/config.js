// Настройки сайта. Меняются без пересборки.
window.TD_CONFIG = {
  // Куда отправлять заказы (POST JSON). На хостинге с PHP работает /api/order.php — он пишет на почту магазина.
  orderEndpoint: '/api/order.php',
  // Резерв, если отправка не удалась: покупателю предложим позвонить или отправить заказ письмом
  email: 'sales@petstore.ru',
  phone: '+7 (3952) 50-40-38',
  phoneHref: 'tel:+73952504038',
  freeFrom: 3000,
  deliveryCost: 300,
  minOrder: 0,
  // Подложка карты магазинов (Leaflet). По умолчанию — OpenStreetMap.
  mapTiles: '',
};
