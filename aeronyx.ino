#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "DHT.h"
#include "MQ7.h"
#include <HardwareSerial.h>
#include <WiFi.h>            // Include WiFi library for ESP32
#include <ThingSpeak.h>      // Include ThingSpeak library

#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels
#define OLED_RESET -1
#define DHTPIN 4 // DHT sensor pin
#define DHTTYPE DHT22 // DHT 22 (AM2302)
#define A_PIN 2 // MQ7 pin
#define VOLTAGE 3.3 // MQ7 voltage
#define SENSOR_PIN_NO2 33 // NO2 sensor pin
#define SENSOR_PIN_PM25 16 // PM2.5 sensor pin (Serial RX)
#define MAX_VOC_PPM 100.0 // Max VOC PPM
#define MOLECULAR_WEIGHT 110 // Molecular weight for VOC

// ThingSpeak credentials
const char* ssid = "POCO F4";     // WiFi SSID
const char* password = "poco@123";  // WiFi password
const long channelID = 3418865;         // Replace with your actual ThingSpeak channel ID
const char* writeAPIKey = "M5XCC7COS9E4TPNP"; // ThingSpeak Write API Key

DHT dht(DHTPIN, DHTTYPE);
MQ7 mq7(A_PIN, VOLTAGE);
HardwareSerial mySerial(1);

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

float temperature, humidity, vocPPM, no2PPM, pm25Concentration, mq7PPM;

// AQI Calculation Constants
const float NO2_CONVERSION = 1885.0; // PPM to µg/m³ for NO2
const float CO_CONVERSION = 1.131;   // PPM to mg/m³ for CO

// AQI Breakpoints
const int PM25_BREAKPOINTS[6][4] = {{0, 30, 0, 50}, {31, 60, 51, 100}, {61, 90, 101, 200}, {91, 120, 201, 300}, {121, 250, 301, 400}, {250, 500, 401, 500}};
const int NO2_BREAKPOINTS[6][4] = {{0, 40, 0, 50}, {41, 80, 51, 100}, {81, 180, 101, 200}, {181, 280, 201, 300}, {281, 400, 301, 400}, {400, 500, 401, 500}};
const float CO_BREAKPOINTS[6][4] = {{0, 1.0, 0, 50}, {1.1, 2.0, 51, 100}, {2.1, 10.0, 101, 200}, {10.1, 17.0, 201, 300}, {17.1, 34.0, 301, 400}, {34.1, 500.0, 401, 500}};

unsigned long lastTime = 0; // Store last time data was sent to ThingSpeak
unsigned long lastSensorRead = 0; // Store last time the sensors were read
unsigned long sensorInterval = 2000; // 2 seconds between sensor reads
unsigned long sendInterval = 30000; // 30 seconds to send data to ThingSpeak

WiFiClient client;  // WiFiClient to handle communication with ThingSpeak

void setup() {
    Serial.begin(115200);
    mySerial.begin(9600, SERIAL_8N1, SENSOR_PIN_PM25);
    display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
    dht.begin();
    pinMode(A_PIN, INPUT);
    analogReadResolution(12);
    mq7.calibrate(); // Calibrates MQ7
    Serial.println("Calibration done!");
    display.display();
    delay(2000);

    // Connect to WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println("Connected to WiFi");

    // Initialize ThingSpeak
    ThingSpeak.begin(client);  // Pass the WiFi client object to ThingSpeak
}

void readSensors() {
    // Read DHT sensor
    humidity = dht.readHumidity();
    temperature = dht.readTemperature();

    // Read VOC sensor
    int sensorValue = analogRead(A_PIN);
    float voltage = (sensorValue / 4095.0) * 3.3;
    vocPPM = (voltage / 3.3) * MAX_VOC_PPM;

    // Read NO2 sensor
    int no2SensorValue = analogRead(SENSOR_PIN_NO2);
    no2PPM = (no2SensorValue / 4095.0) * 10.0; // Convert to ppm

    // Read PM2.5 sensor
    if (mySerial.available() >= 9) {
        byte data[9];
        for (int i = 0; i < 9; i++) {
            data[i] = mySerial.read();
        }
        if (data[0] == 0xFF && data[1] == 0x18) {
            byte lowPulseRateInt = data[3];
            byte lowPulseRateDec = data[4];
            float dutyRatio = lowPulseRateInt + (lowPulseRateDec / 100.0);
            pm25Concentration = 1000 * (dutyRatio / 100.0); // PM2.5 in µg/m³
        }
    }

    // Read MQ7 data
    mq7PPM = mq7.readPpm();

    // Print sensor data to Serial Monitor
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.print(" °C, Humidity: ");
    Serial.print(humidity);
    Serial.print(" %, TVOC: ");
    Serial.print(vocPPM);
    Serial.print(" ppm, NO2: ");
    Serial.print(no2PPM);
    Serial.print(" ppm, PM2.5: ");
    Serial.print(pm25Concentration);
    Serial.print(" µg/m³, CO: ");
    Serial.print(mq7PPM);
    Serial.println(" ppm");
}

// int calculateAQI(float concentration, const int breakpoints[][4]) {
//     for (int i = 0; i < 6; i++) {
//         if (concentration >= breakpoints[i][0] && concentration <= breakpoints[i][1]) {
//             float IHI = breakpoints[i][3];
//             float ILO = breakpoints[i][2];
//             if (ILO > 50) ILO--;
//             float BHI = breakpoints[i][1];
//             float BLO = breakpoints[i][0];
//             return static_cast<int>((((IHI - ILO) / (BHI - BLO)) * (concentration - BLO)) + ILO);
//         }
//     }
//     return 0;
// }

// --------------------- AQI Calculation Logic ---------------------

// Shared AQI formula logic
int calculateAQIFromBreakpoints(float concentration, float BLO, float BHI, float ILO, float IHI) {
    if (ILO > 50) ILO--; // Optional: Adjust ILO to avoid overlap
    return static_cast<int>((((IHI - ILO) / (BHI - BLO)) * (concentration - BLO)) + ILO);
}

// For PM2.5 and NO2 (int breakpoints)
int calculateAQI(float concentration, const int breakpoints[][4]) {
    for (int i = 0; i < 6; i++) {
        if (concentration >= breakpoints[i][0] && concentration <= breakpoints[i][1]) {
            float BLO = breakpoints[i][0];
            float BHI = breakpoints[i][1];
            float ILO = breakpoints[i][2];  // Lower AQI value
            float IHI = breakpoints[i][3];  // Upper AQI value
            return calculateAQIFromBreakpoints(concentration, BLO, BHI, ILO, IHI);
        }
    }
    return 0;  // Default case if concentration is out of range
}

// For CO (float breakpoints)
int calculateAQI(float concentration, const float breakpoints[][4]) {
    for (int i = 0; i < 6; i++) {
        if (concentration >= breakpoints[i][0] && concentration <= breakpoints[i][1]) {
            float BLO = breakpoints[i][0];
            float BHI = breakpoints[i][1];
            float ILO = breakpoints[i][2];  // Lower AQI value
            float IHI = breakpoints[i][3];  // Upper AQI value
            return calculateAQIFromBreakpoints(concentration, BLO, BHI, ILO, IHI);
        }
    }
    return 0;  // Default case if concentration is out of range
}

void calculateAndDisplayAQI(int &overallAQI, const char* &aqiCategory) {
    // Calculate AQI values
    int aqiPM25 = calculateAQI(pm25Concentration, PM25_BREAKPOINTS);
    int aqiNO2 = calculateAQI(no2PPM, NO2_BREAKPOINTS);
    int aqiCO = calculateAQI(mq7PPM * CO_CONVERSION, CO_BREAKPOINTS); // Convert CO to mg/m³

    // Find maximum AQI
    overallAQI = max(aqiPM25, max(aqiNO2, aqiCO));

    // Determine AQI category
    if (overallAQI >= 0 && overallAQI <= 50) {
        aqiCategory = "Good";
    } else if (overallAQI <= 100) {
        aqiCategory = "Satisfactory";
    } else if (overallAQI <= 200) {
        aqiCategory = "Moderate";
    } else if (overallAQI <= 300) {
        aqiCategory = "Poor";
    } else if (overallAQI <= 400) {
        aqiCategory = "Very Poor";
    } else {
        aqiCategory = "Severe";
    }

    // Print AQI values to Serial Monitor
    Serial.print("AQI PM2.5: ");
    Serial.print(aqiPM25);
    Serial.print(", AQI NO2: ");
    Serial.print(aqiNO2);
    Serial.print(", AQI CO: ");
    Serial.print(aqiCO);
    Serial.print(", Overall AQI: ");
    Serial.print(overallAQI);
    Serial.print(", Category: ");
    Serial.println(aqiCategory);
}

void displayData(int overallAQI, const char* aqiCategory) {
    // Clear display for new data
    display.clearDisplay();
    display.fillRect(0, 0, 128, 16, WHITE);
    display.setTextSize(1);
    display.setTextColor(BLACK, WHITE);
    display.setCursor(1, 0);
    display.print("AIR QUALITY");
    display.setCursor(1, 8);
    display.print("MONITORING SYSTEM");
    display.display();

    // Display Temp, Humidity and PM2.5
    display.fillRect(0, 16, 128, 48, BLACK);
    display.setTextSize(2);
    display.setTextColor(WHITE);
    display.setCursor(1, 16);
    display.print("TEMP :");
    display.print(static_cast<int>(temperature)); // Display temperature as an integer
    display.print("C"); // Unit for temperature
    display.setCursor(1, 32);
    display.print("HUMD :");
    display.print(static_cast<int>(humidity)); // Display humidity as an integer
    display.print("%"); // Unit for humidity
    display.setCursor(1, 48);
    display.print("PM2.5:");
    display.print(static_cast<int>(pm25Concentration)); // Display PM2.5 as an integer
    display.print("ug/m3"); // Unit for PM2.5
    display.display();
    delay(2000);

    // Display TVOC, NO2 and CO
    display.fillRect(0, 16, 128, 48, BLACK);
    display.setCursor(1, 16);
    display.print("TVOC :");
    display.print(static_cast<int>(vocPPM)); // Display TVOC as an integer
    display.print("ppm"); // Unit for TVOC
    display.setCursor(1, 32);
    display.print("NO2  :");
    display.print(static_cast<int>(no2PPM)); // Display NO2 as an integer
    display.print("ppm"); // Unit for NO2
    display.setCursor(1, 48);
    display.print("CO   :");
    display.print(static_cast<int>(mq7PPM)); // Display MQ7 CO concentration as an integer
    display.print("ppm"); // Unit for CO
    display.display();
    delay(2000);

    // Display overall AQI
    display.fillRect(0, 16, 128, 48, BLACK);
    display.setTextSize(3);
    display.setTextColor(WHITE);
    display.setCursor(1, 20);
    display.print("AQI:");
    display.print(overallAQI);
    display.setTextSize(2);
    display.setTextColor(WHITE);
    display.setCursor(1, 48);
    display.print(aqiCategory);
    display.display();
    delay(2000);
}

void sendToThingSpeak(int overallAQI, float temperature, float humidity, float vocPPM, float no2PPM, float pm25Concentration, float mq7PPM) {
    ThingSpeak.setField(1, temperature); // Field 1 for temperature
    ThingSpeak.setField(2, humidity);    // Field 2 for humidity
    ThingSpeak.setField(3, pm25Concentration); // Field 3 for PM2.5
    ThingSpeak.setField(4, vocPPM);      // Field 4 for TVOC
    ThingSpeak.setField(5, no2PPM);      // Field 5 for NO2
    ThingSpeak.setField(6, mq7PPM);      // Field 6 for CO
    ThingSpeak.setField(7, overallAQI);  // Field 7 with overall AQI

    // Send data to ThingSpeak
    int result = ThingSpeak.writeFields(channelID, writeAPIKey);

    if (result == 200) {
        Serial.println("Data sent to ThingSpeak successfully.");
    } else {
        Serial.print("Failed to send data to ThingSpeak. Error code: ");
        Serial.println(result);
    }
}

void loop() {
    unsigned long currentMillis = millis();

    // Read sensors every 2 seconds
    if (currentMillis - lastSensorRead >= sensorInterval) {
        lastSensorRead = currentMillis;
        readSensors();
    }

    // Send data to ThingSpeak every 15 seconds
    if (currentMillis - lastTime >= sendInterval) {
        lastTime = currentMillis;
        int overallAQI; // Local variable to store the overall AQI
        const char* aqiCategory; // Local variable to store the AQI category
        calculateAndDisplayAQI(overallAQI, aqiCategory); // Calculate AQI and category, passing the local variables to the function
        sendToThingSpeak(overallAQI, temperature, humidity, vocPPM, no2PPM, pm25Concentration, mq7PPM); // Send to ThingSpeak
        displayData(overallAQI, aqiCategory); // Display on OLED screen
    }
}
