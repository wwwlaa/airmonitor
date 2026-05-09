<?php
// ============================================================
//  get_latest.php  —  AirWatch v2
//  Digunakan oleh fetchLive() di dashboard (setiap 10 detik)
//
//  Mengembalikan SATU baris terbaru dari sensor_raw.
//  Tidak ada status — JS yang hitung kategori.
//
//  Response: { id, temperature, humidity, gas, created_at }
// ============================================================

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=utf-8");

$conn = new mysqli("sql112.infinityfree.com", "if0_41864963", "T4X7IDncF3T", "if0_41864963_airmonitor");
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "DB connection failed"]);
    exit;
}
$conn->set_charset("utf8mb4");

$sql = "SELECT
          id,
          temperature,
          humidity,
          gas,
          DATE_FORMAT(created_at, '%d %b %Y %H:%i:%s') AS created_at
        FROM sensor_raw
        ORDER BY id DESC
        LIMIT 1";

$result = $conn->query($sql);
$row    = $result ? $result->fetch_assoc() : null;
$conn->close();

if (!$row) {
    echo json_encode(["error" => "No data"]);
    exit;
}

echo json_encode([
    "id"          => (int)   $row['id'],
    "temperature" => (float) $row['temperature'],
    "humidity"    => (float) $row['humidity'],
    "gas"         => (int)   $row['gas'],
    "created_at"  =>         $row['created_at']
]);
?>