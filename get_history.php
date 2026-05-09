<?php
// ============================================================
//  get_history.php  —  AirWatch v2
//  Digunakan oleh halaman History dan Alerts
//
//  Parameter GET (opsional):
//    ?granularity=30min|hourly|daily|weekly|monthly
//       Default: 30min
//    ?days=1|2|3|7|30|all
//       Default: 3 (tiga hari terakhir)
//    ?date=YYYY-MM-DD
//       Filter ke satu hari spesifik (override parameter days)
//
//  Response: array of objects
//    { slot_time, temperature, humidity, gas, sample_count }
//    Untuk daily/weekly/monthly juga tersedia: gas_min, gas_max
//
//  TIDAK ada kolom status — JS yang menghitung kategori dari gas.
// ============================================================

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=utf-8");

$conn = new mysqli("localhost", "root", "", "air_monitor");
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "DB connection failed"]);
    exit;
}
$conn->set_charset("utf8mb4");

// ── Baca parameter ──────────────────────────────────────────
$gran = isset($_GET['granularity']) ? $_GET['granularity'] : '30min';
$days = isset($_GET['days'])        ? $_GET['days']         : '3';
$date = isset($_GET['date'])        ? $_GET['date']         : '';

// Whitelist granularity
$allowedGran = ['30min', 'hourly', 'daily', 'weekly', 'monthly'];
if (!in_array($gran, $allowedGran)) $gran = '30min';

// Whitelist days
$allowedDays = ['1','2','3','7','14','30','90','365','all'];
if (!in_array($days, $allowedDays)) $days = '3';

// Validasi format date
$dateFilter = '';
if ($date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    $dateFilter = $date;
}

// ── Tentukan tabel & kolom ──────────────────────────────────
switch ($gran) {
    case '30min':
        $table   = 'sensor_30min';
        $timeCol = 'slot_time';
        $extra   = '';
        break;
    case 'hourly':
        $table   = 'sensor_hourly';
        $timeCol = 'slot_time';
        $extra   = '';
        break;
    case 'daily':
        $table   = 'sensor_daily';
        $timeCol = 'slot_date';
        $extra   = ', gas_min, gas_max, temp_min, temp_max';
        break;
    case 'weekly':
        $table   = 'sensor_weekly';
        $timeCol = 'week_start';
        $extra   = ', gas_min, gas_max';
        break;
    case 'monthly':
        $table   = 'sensor_monthly';
        $timeCol = "STR_TO_DATE(CONCAT(month_key, '-01'), '%Y-%m-%d')";
        $extra   = ', gas_min, gas_max, month_key';
        break;
    default:
        $table   = 'sensor_30min';
        $timeCol = 'slot_time';
        $extra   = '';
}

// ── Bangun WHERE clause ─────────────────────────────────────
$where = '';

if ($dateFilter) {
    // Filter ke satu hari spesifik
    if ($gran === 'monthly') {
        $where = "WHERE month_key = DATE_FORMAT('$dateFilter', '%Y-%m')";
    } elseif ($gran === 'weekly') {
        $where = "WHERE week_start = '$dateFilter'";
    } else {
        $where = "WHERE DATE($timeCol) = '$dateFilter'";
    }
} elseif ($days !== 'all') {
    $daysInt = (int)$days;
    if ($gran === 'monthly') {
        $where = "WHERE month_key >= DATE_FORMAT(NOW() - INTERVAL $daysInt DAY, '%Y-%m')";
    } elseif ($gran === 'weekly') {
        $where = "WHERE week_start >= NOW() - INTERVAL $daysInt DAY";
    } else {
        $where = "WHERE $timeCol >= NOW() - INTERVAL $daysInt DAY";
    }
}

// ── Format kolom waktu untuk output ────────────────────────
if ($gran === 'monthly') {
    $timeSelect = "DATE_FORMAT(STR_TO_DATE(CONCAT(month_key, '-01'), '%Y-%m-%d'), '%d %b %Y') AS slot_time";
} elseif ($gran === 'daily') {
    $timeSelect = "DATE_FORMAT(slot_date, '%d %b %Y') AS slot_time";
} elseif ($gran === 'weekly') {
    $timeSelect = "DATE_FORMAT(week_start, '%d %b %Y') AS slot_time";
} else {
    $timeSelect = "DATE_FORMAT($timeCol, '%d %b %Y %H:%i:%s') AS slot_time";
}

// ── Query ───────────────────────────────────────────────────
$sql = "SELECT
          $timeSelect,
          temperature,
          humidity,
          gas,
          sample_count
          $extra
        FROM $table
        $where
        ORDER BY $timeCol DESC
        LIMIT 1000";

$result = $conn->query($sql);
$data   = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $item = [
            "slot_time"    =>         $row['slot_time'],
            "temperature"  => (float) $row['temperature'],
            "humidity"     => (float) $row['humidity'],
            "gas"          => (int)   $row['gas'],
            "sample_count" => (int)   $row['sample_count']
        ];
        // Tambahkan kolom ekstra jika ada
        if (isset($row['gas_min']))  $item['gas_min']  = (int)   $row['gas_min'];
        if (isset($row['gas_max']))  $item['gas_max']  = (int)   $row['gas_max'];
        if (isset($row['temp_min'])) $item['temp_min'] = (float) $row['temp_min'];
        if (isset($row['temp_max'])) $item['temp_max'] = (float) $row['temp_max'];
        if (isset($row['month_key'])) $item['month_key'] = $row['month_key'];
        $data[] = $item;
    }
}

$conn->close();
echo json_encode($data, JSON_UNESCAPED_UNICODE);
?>