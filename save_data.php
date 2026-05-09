<?php
// ============================================================
//  save_data.php  —  AirWatch v2
//  ESP8266 kirim: save_data.php?temp=XX&hum=XX&gas=XX
//
//  PERUBAHAN dari v1:
//    - Simpan ke tabel sensor_raw (bukan sensor_data)
//    - Kolom status DIHAPUS — status hanya dihitung di JavaScript
//    - Auto-delete DIHAPUS — digantikan MySQL Event Scheduler
//    - Konversi ADC tetap ada di sini (PHP harus tetap kirim indeks 0-500)
// ============================================================

header("Content-Type: application/json; charset=utf-8");

// ── Koneksi DB ───────────────────────────────────────────────
$conn = new mysqli("localhost", "root", "", "air_monitor");
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "DB connection failed"]);
    exit;
}
$conn->set_charset("utf8mb4");

// ── Sanitasi input ───────────────────────────────────────────
$temp   = isset($_GET['temp']) ? round(floatval($_GET['temp']), 1) : 0.0;
$hum    = isset($_GET['hum'])  ? round(floatval($_GET['hum']),  1) : 0.0;
$rawGas = isset($_GET['gas'])  ? intval($_GET['gas'])               : 0;

// Konversi ADC (0–1023) → Indeks Gas (0–500)
// Konsisten dengan versi lama — JANGAN diubah
$gas = (int) round(($rawGas / 1023) * 500);
$gas = max(0, min($gas, 500));

// ── Simpan ke sensor_raw ─────────────────────────────────────
$stmt = $conn->prepare(
    "INSERT INTO sensor_raw (temperature, humidity, gas, created_at)
     VALUES (?, ?, ?, NOW())"
);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Prepare failed: " . $conn->error]);
    $conn->close();
    exit;
}
$stmt->bind_param("ddi", $temp, $hum, $gas);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Execute failed: " . $stmt->error]);
    $stmt->close();
    $conn->close();
    exit;
}
$stmt->close();
$conn->close();

// ── Response ─────────────────────────────────────────────────
echo json_encode([
    "ok"     => true,
    "temp"   => $temp,
    "hum"    => $hum,
    "gas"    => $gas,
    "rawGas" => $rawGas
]);
?>