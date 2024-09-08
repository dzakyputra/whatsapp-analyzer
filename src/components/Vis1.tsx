import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HourlyStats {
  total: number;
  byPerson: { [person: string]: number };
}
  
interface SalesChartProps {
  data: { [hour: string]: HourlyStats };
}

interface Data {
  [key: string]: string | number;
}

const SalesChart: React.FC<SalesChartProps> = ({ data }) => {

  const chartData: Data[] = [];

  {Object.entries(data).map(([hour, hourlyStats]) => {
    chartData.push(hourlyStats.byPerson)
  })}

  console.log("CHART DATA", chartData)

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="sales" stroke="#8884d8" activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SalesChart;