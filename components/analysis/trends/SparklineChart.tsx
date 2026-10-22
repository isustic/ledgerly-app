"use client";

import { useEffect, useRef } from "react";

interface SparklineChartProps {
    data: number[];
    width?: number;
    height?: number;
}

export function SparklineChart({ data, width = 200, height = 50 }: SparklineChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || data.length < 2) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;

        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#1f7a5c";
        ctx.lineWidth = 2;

        data.forEach((value, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((value - min) / range) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();
    }, [data, width, height]);

    return <canvas ref={canvasRef} width={width} height={height} />;
}
