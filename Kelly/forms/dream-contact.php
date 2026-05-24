<?php
/**
 * Dream Contact Form Handler
 * Sends email to admin with lead details
 */

// Set JSON response header
header('Content-Type: application/json');

// Enable CORS if needed
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Get JSON data
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Validate required fields
if (!isset($data['name']) || !isset($data['mobile']) || !isset($data['email']) || !isset($data['projectType'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

// Sanitize input
$name = htmlspecialchars(trim($data['name']));
$mobile = htmlspecialchars(trim($data['mobile']));
$email = filter_var(trim($data['email']), FILTER_SANITIZE_EMAIL);
$projectType = htmlspecialchars(trim($data['projectType']));
$message = isset($data['message']) ? htmlspecialchars(trim($data['message'])) : 'No message provided';

// Validate email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email address']);
    exit;
}

// Admin email (UPDATE THIS WITH YOUR ACTUAL EMAIL)
$admin_email = 'anshikarastogi0007@gmail.com'; // Your actual email
$subject = '🎨 New Dream Home Lead: ' . $projectType;

// Create email body
$email_body = "
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        .header { background: linear-gradient(135deg, #FFD700, #FFA500); padding: 30px; text-align: center; color: #000; border-radius: 10px 10px 0 0; }
        .content { background: #fff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .field { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-left: 4px solid #FFD700; border-radius: 5px; }
        .label { font-weight: bold; color: #555; font-size: 12px; text-transform: uppercase; }
        .value { font-size: 16px; color: #000; margin-top: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
        .cta { margin-top: 30px; text-align: center; }
        .cta a { background: #FFD700; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1 style='margin: 0; font-size: 28px;'>✨ New Dream Lead!</h1>
            <p style='margin: 10px 0 0 0; font-size: 14px;'>Someone wants to build their dream home</p>
        </div>
        <div class='content'>
            <div class='field'>
                <div class='label'>👤 Name</div>
                <div class='value'>{$name}</div>
            </div>
            <div class='field'>
                <div class='label'>📱 Mobile Number</div>
                <div class='value'>{$mobile}</div>
            </div>
            <div class='field'>
                <div class='label'>📧 Email Address</div>
                <div class='value'>{$email}</div>
            </div>
            <div class='field'>
                <div class='label'>🏠 Project Type</div>
                <div class='value'>{$projectType}</div>
            </div>
            <div class='field'>
                <div class='label'>💭 Their Vision</div>
                <div class='value'>{$message}</div>
            </div>
            <div class='field'>
                <div class='label'>⏰ Submitted At</div>
                <div class='value'>" . date('d M Y, h:i A') . "</div>
            </div>
            <div class='cta'>
                <a href='https://wa.me/{$mobile}' target='_blank'>💬 Contact on WhatsApp</a>
            </div>
        </div>
        <div class='footer'>
            <p>💫 Follow up within 24 hours for best conversion!</p>
            <p>Sent from Anshika Rastogi Portfolio Website</p>
        </div>
    </div>
</body>
</html>
";

// Email headers
$headers = array(
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: Dream Lead <noreply@anshikarastogi.com>',
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion()
);

// Send email
$mail_sent = mail($admin_email, $subject, $email_body, implode("\r\n", $headers));

// Also save to database (optional - uncomment if you want to store leads)
/*
try {
    $db_file = '../admin/database.sqlite';
    if (file_exists($db_file)) {
        $db = new PDO('sqlite:' . $db_file);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $stmt = $db->prepare("
            INSERT INTO contacts (name, email, phone, subject, message, created_at)
            VALUES (:name, :email, :phone, :subject, :message, :created_at)
        ");

        $stmt->execute([
            ':name' => $name,
            ':email' => $email,
            ':phone' => $mobile,
            ':subject' => 'Dream Home - ' . $projectType,
            ':message' => $message,
            ':created_at' => date('Y-m-d H:i:s')
        ]);
    }
} catch (Exception $e) {
    // Log error but don't fail the request
    error_log('Database error: ' . $e->getMessage());
}
*/

if ($mail_sent) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Email sent successfully!'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to send email. Please try again.'
    ]);
}
?>
