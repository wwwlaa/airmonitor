<?php
// ============================================================
//  get_summary.php  —  AirWatch v2
//  Endpoint untuk kartu statistik / summary panel di dashboard
//
//  Parameter GET:
//    ?period=today|week|month|all   (default: today)
//
//  Response:
//  {
//    "period": "today",
//    "gas":  { "avg": 45, "min": 20, "max": 120, "samples": 864 },
//    "temp": { "avg": 29.3, "min": 26.1, "max": 32.5 },
//    "hum":  { "avg": 74.2, "min": 60.0, "max": 88.0 }
//  }
//
//  Tidak ada kolom status — JS yang menghitung kategori.
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

$period = isset($_GET['period']) ? $_GET['period'] : 'today';
$allowed = ['today', 'week', 'month', 'all'];
if (!in_array($period, $allowed)) $period = 'today';

// Tentukan rentang waktu
switch ($period) {
    case 'today':
        $where = "WHERE DATE(created_at) = CURDATE()";
        break;
    case 'week':
        $where = "WHERE created_at >= NOW() - INTERVAL 7 DAY";
        break;
    case 'month':
        $where = "WHERE created_at >= NOW() - INTERVAL 30 DAY";
        break;
    default: // all
        $where = "";
}

$sql = "SELECT
          ROUND(AVG(gas),         0) AS gas_avg,
          MIN(gas)                   AS gas_min,
          MAX(gas)                   AS gas_max,
          ROUND(AVG(temperature), 1) AS temp_avg,
          MIN(temperature)           AS temp_min,
          MAX(temperature)           AS temp_max,
          ROUND(AVG(humidity),    1) AS hum_avg,
          MIN(humidity)              AS hum_min,
          MAX(humidity)              AS hum_max,
          COUNT(*)                   AS samples
        FROM sensor_raw
        $where";

$result = $conn->query($sql);
$row    = $result ? $result->fetch_assoc() : null;
$conn->close();

if (!$row || $row['samples'] == 0) {
    echo json_encode([
        "period"  => $period,
        "gas"     => null,
        "temp"    => null,
        "hum"     => null,
        "samples" => 0
    ]);
    exit;
}

echo json_encode([
    "period" => $period,
    "gas"  => [
        "avg" => (int)   $row['gas_avg'],
        "min" => (int)   $row['gas_min'],
        "max" => (int)   $row['gas_max']
    ],
    "temp" => [
        "avg" => (float) $row['temp_avg'],
        "min" => (float) $row['temp_min'],
        "max" => (float) $row['temp_max']
    ],
    "hum"  => [
        "avg" => (float) $row['hum_avg'],
        "min" => (float) $row['hum_min'],
        "max" => (float) $row['hum_max']
    ],
    "samples" => (int) $row['samples']
], JSON_UNESCAPED_UNICODE);
?>