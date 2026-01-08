"use client";

import * as React from "react";
import {
  Typography,
  Box,
  Paper,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
} from "@mui/material";
import axios from "@/lib/AxiosClient";

interface SensorReading {
  timestamp: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  pm1_0?: number;
  pm2_5?: number;
  pm10_0?: number;
  battery_voltage?: number;
  battery_percent?: number;
}

interface SensorHistoryProps {
  deviceId: number;
}

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";

export default function SensorHistory({ deviceId }: SensorHistoryProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<SensorReading[]>([]);
  const [timeRange, setTimeRange] = React.useState<TimeRange>("24h");
  const [selectedMetric, setSelectedMetric] = React.useState<string>("temperature");

  const fetchHistory = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/devices/${deviceId}/sensors/history`, {
        params: { range: timeRange },
      });
      setData(response.data);
    } catch (err) {
      console.error("Failed to fetch sensor history:", err);
      setError("Nie udało się pobrać historii odczytów");
    } finally {
      setLoading(false);
    }
  }, [deviceId, timeRange]);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Pobierz wartości dla wybranej metryki
  const getMetricData = () => {
    return data.map((reading) => {
      const date = new Date(reading.timestamp);
      let value: number | undefined;
      
      switch (selectedMetric) {
        case "temperature":
          value = reading.temperature;
          break;
        case "humidity":
          value = reading.humidity;
          break;
        case "pressure":
          value = reading.pressure ? reading.pressure / 100 : undefined;
          break;
        case "pm2_5":
          value = reading.pm2_5;
          break;
        case "battery":
          value = reading.battery_percent;
          break;
        default:
          value = reading.temperature;
      }
      
      return { date, value };
    }).filter((d) => d.value !== undefined);
  };

  const metrics = [
    { key: "temperature", label: "Temperatura", unit: "°C", color: "#ef4444" },
    { key: "humidity", label: "Wilgotność", unit: "%", color: "#3b82f6" },
    { key: "pressure", label: "Ciśnienie", unit: "hPa", color: "#22c55e" },
    { key: "pm2_5", label: "PM2.5", unit: "µg/m³", color: "#f59e0b" },
    { key: "battery", label: "Bateria", unit: "%", color: "#8b5cf6" },
  ];

  const currentMetric = metrics.find((m) => m.key === selectedMetric);
  const metricData = getMetricData();

  // Oblicz statystyki
  const values = metricData.map((d) => d.value).filter((v): v is number => v !== undefined);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  // Prosty wykres SVG
  const renderChart = () => {
    if (metricData.length === 0) {
      return (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography color="text.secondary">Brak danych dla wybranego okresu</Typography>
        </Box>
      );
    }

    const width = 700;
    const height = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const minVal = Math.min(...values) * 0.95;
    const maxVal = Math.max(...values) * 1.05;
    const valueRange = maxVal - minVal || 1;

    const timeMin = metricData[0]?.date.getTime() ?? 0;
    const timeMax = metricData[metricData.length - 1]?.date.getTime() ?? 1;
    const timeRange = timeMax - timeMin || 1;

    const points = metricData.map((d) => {
      const x = padding.left + ((d.date.getTime() - timeMin) / timeRange) * chartWidth;
      const y = padding.top + chartHeight - (((d.value ?? minVal) - minVal) / valueRange) * chartHeight;
      return { x, y, date: d.date, value: d.value };
    });

    // Linia wykresu
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    // Obszar pod linią
    const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

    // Oś Y - wartości
    const yTicks = 5;
    const yTickValues = Array.from({ length: yTicks }, (_, i) => minVal + (valueRange / (yTicks - 1)) * i);

    // Oś X - czas
    const xTicks = 6;
    const formatTime = (date: Date) => {
      if (timeRange > 86400000 * 2) {
        return date.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
      }
      return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    };

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
        {/* Grid lines */}
        {yTickValues.map((val, i) => {
          const y = padding.top + chartHeight - ((val - minVal) / valueRange) * chartHeight;
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="4"
              />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#6b7280">
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill={currentMetric?.color ?? "#3b82f6"} opacity={0.1} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={currentMetric?.color ?? "#3b82f6"} strokeWidth={2} />

        {/* Data points */}
        {points.length <= 50 &&
          points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={currentMetric?.color ?? "#3b82f6"}
            />
          ))}

        {/* X axis labels */}
        {Array.from({ length: xTicks }, (_, i) => {
          const time = timeMin + (timeRange / (xTicks - 1)) * i;
          const x = padding.left + (i / (xTicks - 1)) * chartWidth;
          return (
            <text
              key={i}
              x={x}
              y={height - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#6b7280"
            >
              {formatTime(new Date(time))}
            </text>
          );
        })}

        {/* Y axis label */}
        <text
          x={15}
          y={height / 2}
          textAnchor="middle"
          fontSize="12"
          fill="#374151"
          transform={`rotate(-90, 15, ${height / 2})`}
        >
          {currentMetric?.label} ({currentMetric?.unit})
        </text>
      </svg>
    );
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        📈 Historia odczytów - Urządzenie #{deviceId}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Wybór metryki */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Wybierz parametr:
        </Typography>
        <ToggleButtonGroup
          value={selectedMetric}
          exclusive
          onChange={(_, value) => value && setSelectedMetric(value)}
          size="small"
        >
          {metrics.map((m) => (
            <ToggleButton
              key={m.key}
              value={m.key}
              sx={{
                "&.Mui-selected": {
                  backgroundColor: m.color,
                  color: "white",
                  "&:hover": { backgroundColor: m.color, opacity: 0.9 },
                },
              }}
            >
              {m.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Wybór zakresu czasu */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Zakres czasu:
        </Typography>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(_, value) => value && setTimeRange(value)}
          size="small"
        >
          <ToggleButton value="1h">1 godz.</ToggleButton>
          <ToggleButton value="6h">6 godz.</ToggleButton>
          <ToggleButton value="24h">24 godz.</ToggleButton>
          <ToggleButton value="7d">7 dni</ToggleButton>
          <ToggleButton value="30d">30 dni</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Wykres */}
      <Paper sx={{ p: 2, mb: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          renderChart()
        )}
      </Paper>

      {/* Statystyki */}
      {!loading && values.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Statystyki ({currentMetric?.label})
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Minimum</Typography>
              <Typography variant="h6">
                {min.toFixed(1)} {currentMetric?.unit}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Maksimum</Typography>
              <Typography variant="h6">
                {max.toFixed(1)} {currentMetric?.unit}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Średnia</Typography>
              <Typography variant="h6">
                {avg.toFixed(1)} {currentMetric?.unit}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Odczytów</Typography>
              <Typography variant="h6">{values.length}</Typography>
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
