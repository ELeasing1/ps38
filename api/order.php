<?php
/**
 * Приём заказов с сайта «Умный зоомагазин.рф» (ООО «Петстор»).
 * Отправляет заказ письмом на почту магазина и (если указан) создаёт лид в Битрикс24.
 * Требуется PHP 7.4+ с функцией mail() (есть на большинстве хостингов).
 */

// ===== Настройки =====
$ORDER_EMAIL   = 'sales@petstore.ru';  // куда приходят заказы
$B24_WEBHOOK   = '';                         // например: https://xxx.bitrix24.ru/rest/1/abcdef123456/ — оставьте пустым, если не нужно
$FROM_NAME     = 'Сайт Умный зоомагазин';
// =====================

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function out($code, $data) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(405, ['ok' => false, 'error' => 'method']);

$raw = file_get_contents('php://input', false, null, 0, 65536);
$d = json_decode($raw, true);
if (!is_array($d)) out(400, ['ok' => false, 'error' => 'json']);
if (!empty($d['website'])) out(200, ['ok' => true, 'id' => '0']); // ловушка для ботов

// простая защита от частых отправок: 6 заказов за 10 минут с одного IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$rl = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'td_rl_' . md5($ip);
$now = time();
$hits = is_file($rl) ? array_filter(explode(',', (string)@file_get_contents($rl)), function ($t) use ($now) { return $now - (int)$t < 600; }) : [];
if (count($hits) >= 6) out(429, ['ok' => false, 'error' => 'rate']);
$hits[] = $now; @file_put_contents($rl, implode(',', $hits));

function clean($s, $max = 300) {
  $s = trim((string)$s);
  $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s);
  return mb_substr($s, 0, $max, 'UTF-8');
}
function line($s, $max = 300) { return preg_replace('/\s+/u', ' ', clean($s, $max)); }

$name  = line($d['name'] ?? '', 80);
$phone = preg_replace('/[^\d+()\- ]/', '', (string)($d['phone'] ?? ''));
$digits = preg_replace('/\D/', '', $phone);
if (mb_strlen($name, 'UTF-8') < 2 || strlen($digits) < 10 || strlen($digits) > 12) out(422, ['ok' => false, 'error' => 'fields']);

$id = date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
$type = ($d['type'] ?? '') === 'quick' ? 'Быстрый заказ — перезвонить клиенту' : 'Заказ из корзины';

$L = [];
$L[] = "Заказ №$id";
$L[] = $type;
$L[] = '';
$L[] = "Имя: $name";
$L[] = "Телефон: $phone";
if (!empty($d['email'])) $L[] = 'E-mail: ' . line($d['email'], 120);
if (!empty($d['delivery'])) $L[] = 'Получение: ' . line($d['delivery'], 120);
if (!empty($d['store'])) $L[] = 'Магазин: ' . line($d['store'], 200);
if (!empty($d['address'])) $L[] = 'Адрес: ' . line($d['address'], 300);
if (!empty($d['payment'])) $L[] = 'Оплата: ' . line($d['payment'], 80);
if (!empty($d['bonusCard'])) $L[] = 'Клубная карта: ' . line($d['bonusCard'], 40);
if (!empty($d['wantCard'])) $L[] = 'Оформить клубную карту: да';
if (!empty($d['comment'])) $L[] = 'Комментарий: ' . clean($d['comment'], 1000);
$L[] = '';
$L[] = 'Товары:';
$sum = 0;
$items = is_array($d['items'] ?? null) ? array_slice($d['items'], 0, 100) : [];
foreach ($items as $it) {
  $q = max(1, min(999, (int)($it['q'] ?? 1)));
  $p = max(0, (float)($it['price'] ?? 0));
  $sum += $q * $p;
  $L[] = '— ' . line($it['name'] ?? '', 200) . (!empty($it['label']) ? ' (' . line($it['label'], 60) . ')' : '')
    . " × $q = " . number_format($q * $p, 0, '.', ' ') . ' ₽'
    . (!empty($it['id']) ? ' [товар ' . preg_replace('/\D/', '', (string)$it['id']) . ', предложение ' . preg_replace('/\D/', '', (string)($it['oid'] ?? '')) . ']' : '');
}
$L[] = '';
$L[] = 'Сумма товаров: ' . number_format($sum, 0, '.', ' ') . ' ₽';
if (isset($d['deliveryCost'])) $L[] = 'Доставка: ' . number_format((float)$d['deliveryCost'], 0, '.', ' ') . ' ₽';
if (isset($d['total'])) $L[] = 'Итого (по ценам сайта): ' . number_format((float)$d['total'], 0, '.', ' ') . ' ₽';
$L[] = '';
$L[] = 'Отправлено: ' . date('d.m.Y H:i') . ' · IP ' . $ip;
$body = implode("\n", $L);

$host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
$enc = function ($s) { return '=?UTF-8?B?' . base64_encode($s) . '?='; };
$headers = "MIME-Version: 1.0\r\n"
  . "Content-Type: text/plain; charset=UTF-8\r\n"
  . "Content-Transfer-Encoding: 8bit\r\n"
  . 'From: ' . $enc($FROM_NAME) . " <noreply@$host>\r\n";
$mailOk = @mail($ORDER_EMAIL, $enc("Заказ №$id — $name"), $body, $headers);

$b24Ok = false;
if ($B24_WEBHOOK && function_exists('curl_init')) {
  $ch = curl_init(rtrim($B24_WEBHOOK, '/') . '/crm.lead.add.json');
  curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
    CURLOPT_POSTFIELDS => http_build_query(['fields' => [
      'TITLE' => "Заказ с сайта №$id", 'NAME' => $name, 'SOURCE_ID' => 'WEB',
      'PHONE' => [['VALUE' => $phone, 'VALUE_TYPE' => 'WORK']],
      'OPPORTUNITY' => $d['total'] ?? $sum, 'CURRENCY_ID' => 'RUB', 'COMMENTS' => nl2br(htmlspecialchars($body)),
    ]]),
  ]);
  $res = curl_exec($ch);
  $b24Ok = $res && strpos($res, '"result"') !== false;
  curl_close($ch);
}

if (!$mailOk && !$b24Ok) out(502, ['ok' => false, 'error' => 'send', 'id' => $id]);
out(200, ['ok' => true, 'id' => $id]);
