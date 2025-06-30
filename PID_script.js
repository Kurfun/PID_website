class PID {
    constructor(Kp = 1.0, Ki = 0.0, Kd = 0.0) {
        this.Kp = Kp;
        this.Ki = Ki;
        this.Kd = Kd;
        this.setpoint = 0.0;
        this.integral = 0.0;
        this.last_error = 0.0;
        this.last_time = performance.now() / 1000;
    }

    compute(current_value) {
        const current_time = performance.now() / 1000;
        let dt = current_time - this.last_time;
        if (dt <= 0.0) {
            return 0;
        }

        const error = this.setpoint - current_value;
        this.integral += error * dt;
        const derivative = (error - this.last_error) / dt;

        const output = (this.Kp * error) + (this.Ki * this.integral) + (this.Kd * derivative);

        this.last_error = error;
        this.last_time = current_time;
        return output;
    }
}

class PIDApp {
    constructor() {
        this.currentMode = 'fan'; // 'fan' 或 'angle'
        this.pid = new PID();

        // 風扇模式變數
        this.current_speed = 0.0;
        this.angle = 0.0;
        this.fan_radius = 60;
        this.frame_radius = 80;

        // 角度模式變數
        this.current_angle = 90.0;
        this.pointer_length = 120;

        this.output_history = [];
        this.time_history = [];
        this.max_data_points = 200;

        this.start_time = performance.now() / 1000;
        this.last_update_time = this.start_time;

        this.offsetY = 60;  // <-- 整體往下移動 40 像素

        this.initElements();
        this.initVisualization();
        this.initChart();

        this.running = true;
        this.updateLoop();
    }

    initElements() {
        this.kpInput = document.getElementById('kp');
        this.kiInput = document.getElementById('ki');
        this.kdInput = document.getElementById('kd');
        this.setpointInput = document.getElementById('setpoint');
        this.setpointLabel = document.getElementById('setpointLabel');
        this.statusText = document.getElementById('statusText');
        this.modeToggle = document.getElementById('modeToggle');

        this.modeToggle.addEventListener('click', () => this.toggleMode());
    }

    toggleMode() {
        this.currentMode = this.currentMode === 'fan' ? 'angle' : 'fan';

        if (this.currentMode === 'angle') {
            this.modeToggle.textContent = '切換到速度控制模式';
            this.setpointLabel.textContent = '目標角度 (0~180)';
            this.setpointInput.min = '0';
            this.setpointInput.max = '180';
            this.setpointInput.value = '90';
            this.setpointInput.step = '1';

            // 重置PID參數為角度控制推薦值
            this.kpInput.value = '20';
            this.kiInput.value = '0.3';
            this.kdInput.value = '0.2';

            // 重置PID控制器
            this.pid = new PID(20, 0.3, 0.2);
        } else {
            this.modeToggle.textContent = '切換到角度控制模式';
            this.setpointLabel.textContent = '目標速度 (-5~5)';
            this.setpointInput.min = '-5';
            this.setpointInput.max = '5';
            this.setpointInput.value = '0';
            this.setpointInput.step = '1';

            // 重置PID參數為風扇控制推薦值
            this.kpInput.value = '10';
            this.kiInput.value = '0.3';
            this.kdInput.value = '0.5';

            // 重置PID控制器
            this.pid = new PID(1.2, 0.3, 0.5);
        }

        this.initVisualization();
    }

    initVisualization() {
        this.canvas = document.getElementById('visualizationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.center_x = this.canvas.width / 2;
        this.center_y = this.canvas.height / 2;

        this.drawVisualizationFrame();
    }

    drawVisualizationFrame() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.currentMode === 'fan') {
            // 風扇外框往下移動 offsetY
            this.ctx.beginPath();
            this.ctx.arc(this.center_x, this.center_y + this.offsetY, this.frame_radius, 0, 2 * Math.PI);
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // 中心軸往下移動 offsetY
            this.ctx.beginPath();
            this.ctx.arc(this.center_x, this.center_y + this.offsetY, 8, 0, 2 * Math.PI);
            this.ctx.fillStyle = 'black';
            this.ctx.fill();
        } else {
            // 量角器弧往下移動 offsetY
            this.ctx.beginPath();
            this.ctx.arc(this.center_x, this.center_y + this.offsetY, 160, Math.PI, 2 * Math.PI);
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // 刻度往下移動 offsetY
            for (let deg = 0; deg <= 180; deg += 30) {
                const rad = Math.PI + Math.PI * deg / 180;
                const x = this.center_x + 140 * Math.cos(rad);
                const y = this.center_y + this.offsetY + 140 * Math.sin(rad);

                this.ctx.font = '12px Microsoft JhengHei';
                this.ctx.fillStyle = 'black';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(deg.toString(), x, y);
            }
        }
    }

    updateVisualization() {
        this.drawVisualizationFrame();

        if (this.currentMode === 'fan') {
            // 風扇葉片往下移動 offsetY
            for (let i = 0; i < 3; i++) {
                const angle_offset = this.angle + i * (2 * Math.PI / 3);
                const x_end = this.center_x + this.fan_radius * Math.cos(angle_offset);
                const y_end = this.center_y + this.offsetY + this.fan_radius * Math.sin(angle_offset);

                this.ctx.beginPath();
                this.ctx.moveTo(this.center_x, this.center_y + this.offsetY);
                this.ctx.lineTo(x_end, y_end);
                this.ctx.strokeStyle = i === 2 ? 'blue' : 'gray';
                this.ctx.lineWidth = 8;
                this.ctx.stroke();
            }

            this.statusText.textContent = `轉速: ${this.current_speed.toFixed(2)} rad/s`;
        } else {
            // 指針往下移動 offsetY
            const angle_rad = Math.PI + Math.PI * this.current_angle / 180;
            const x_end = this.center_x + this.pointer_length * Math.cos(angle_rad);
            const y_end = this.center_y + this.offsetY + this.pointer_length * Math.sin(angle_rad);

            this.ctx.beginPath();
            this.ctx.moveTo(this.center_x, this.center_y + this.offsetY);
            this.ctx.lineTo(x_end, y_end);
            this.ctx.strokeStyle = 'red';
            this.ctx.lineWidth = 6;
            this.ctx.stroke();

            this.statusText.textContent = `角度: ${this.current_angle.toFixed(1)}°`;
        }
    }

    initChart() {
        this.chartCtx = document.getElementById('chart').getContext('2d');
        this.chart = new Chart(this.chartCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '數值',
                    borderColor: 'rgb(135, 210, 235)',
                    tension: 0.1,
                    data: []
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'time(s)'
                        },
                        min: 0,
                        max: 10
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Output'
                        }
                    }
                }
            }
        });
    }

    updateChart() {
        if (this.time_history.length === 0) return;

        // 根據當前模式調整圖表範圍
        if (this.currentMode === 'fan') {
            this.chart.options.scales.y.min = -5;
            this.chart.options.scales.y.max = 5;
            this.chart.data.datasets[0].label = '轉速 (rad/s)';
        } else {
            this.chart.options.scales.y.min = 0;
            this.chart.options.scales.y.max = 180;
            this.chart.data.datasets[0].label = '角度°';
        }

        const chartData = this.time_history.map((t, i) => ({
            x: t,
            y: this.output_history[i]
        }));

        this.chart.data.datasets[0].data = chartData;
        this.chart.options.scales.x.min = Math.max(0, this.time_history[0]);
        this.chart.options.scales.x.max = this.time_history[this.time_history.length - 1] + 1;
        this.chart.update();
    }

    updateLoop() {
        if (!this.running) return;

        const current_time = performance.now() / 1000;
        const dt = current_time - this.last_update_time;
        this.last_update_time = current_time;

        // 更新PID參數
        this.pid.Kp = parseFloat(this.kpInput.value) || 0;
        this.pid.Ki = parseFloat(this.kiInput.value) || 0;
        this.pid.Kd = parseFloat(this.kdInput.value) || 0;

        if (this.currentMode === 'fan') {
            let target_speed = parseFloat(this.setpointInput.value) || 0;
            target_speed = Math.max(-5, Math.min(5, target_speed));
            this.pid.setpoint = target_speed;

            const acceleration = this.pid.compute(this.current_speed);
            this.current_speed += acceleration * dt;
            this.angle += this.current_speed * dt;
            this.angle %= 2 * Math.PI;
        } else {
            let target_angle = parseFloat(this.setpointInput.value) || 90;
            target_angle = Math.max(0, Math.min(180, target_angle));
            this.pid.setpoint = target_angle;

            const correction = this.pid.compute(this.current_angle);
            this.current_angle += correction * dt;
            this.current_angle = Math.max(0, Math.min(180, this.current_angle));
        }

        this.updateVisualization();

        const elapsed = current_time - this.start_time;
        const current_value = this.currentMode === 'fan' ? this.current_speed : this.current_angle;
        this.output_history.push(current_value);
        this.time_history.push(elapsed);

        if (this.output_history.length > this.max_data_points) {
            this.output_history.shift();
            this.time_history.shift();
        }

        this.updateChart();

        requestAnimationFrame(() => this.updateLoop());
    }
}

window.onload = () => {
    const app = new PIDApp();
};
