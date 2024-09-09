"use client"

import { useState } from 'react';
import JSZip from 'jszip';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface PersonStats {
  totalChats: number;
  totalWords: number;
  totalStickers: number;
  totalImages: number;
  totalVideos: number;
  totalTexts: number;
  isHighestChats: boolean;
  isHighestWords: boolean;
  isHighestStickers: boolean;
  isHighestImages: boolean;
  isHighestVideos: boolean;
  isHighestTexts: boolean;
}

interface DailyStats {
  total: number;
  byPerson: { [person: string]: number };
}

interface HourlyStats {
  total: number;
  byPerson: { [person: string]: number };
}

interface WeekdayStats {
  total: number;
  byPerson: { [person: string]: number };
}

interface ChatStats {
  totalChats: number;
  totalWords: number;
  persons: { [person: string]: PersonStats };
  dailyChats: { [date: string]: DailyStats };
  hourlyChats: { [hour: string]: HourlyStats };
  weekdayChats: { [weekday: string]: WeekdayStats };
}

interface ChatMessages {
  message: string;
  sender: string;
}

interface TotalPerPerson {
  name: string;
  data: number[];
}

interface TotalPerDay {
  data: Total[];
}

interface Total {
  x: number;
  y: number;
}

interface ChartData {
  dataWeeklyPerPerson: TotalPerPerson[];
  dataHourlyPerPerson: TotalPerPerson[];
  dataTotalPerDay: TotalPerDay[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num);
  }

  const extractDate = (timestamp: string): string => {
    return timestamp.split(',')[0].trim();
  };

  const extractHour = (timestamp: string): string => {
    return timestamp.split(',')[1].trim().split('.')[0];
  };

  const getWeekday = (dateStr: string): string => {
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(2000 + year, month - 1, day);
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  };

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const analyzeText = (text: string) => {
    const lines = text.split('\n');
    
    let totalChats = 0;
    let totalWords = 0;
    const messages: ChatMessages[] = [];
    const persons: { [person: string]: PersonStats } = {};
    const dailyChats: { [date: string]: DailyStats } = {};
    const hourlyChats: { [hour: string]: HourlyStats } = {};
    const weekdayChats: { [weekday: string]: WeekdayStats } = {
      'Monday': { total: 0, byPerson: {} },
      'Tuesday': { total: 0, byPerson: {} },
      'Wednesday': { total: 0, byPerson: {} },
      'Thursday': { total: 0, byPerson: {} },
      'Friday': { total: 0, byPerson: {} },
      'Saturday': { total: 0, byPerson: {} },
      'Sunday': { total: 0, byPerson: {} },
    };

    let currentPerson = '';
    let currentMessage = '';
    let allMessages = '';

    const uniqueNames = new Map<string, boolean>();
    let ignoredName = '';
    let isGroup = false;

    for (let line of lines) {
      line = line.replace(/\u200E/g, '')
      const chatStart = line.match(/^\[(\d{2}\/\d{2}\/\d{2}, \d{2}\.\d{2}\.\d{2})] (.*?): (.*)/);
      if (chatStart) {
        const [, timestamp, person] = chatStart;
        if (uniqueNames.size == 0) {
          ignoredName = person
        }
        uniqueNames.set(person, true)
      }
      if (uniqueNames.size > 2) {
        isGroup = true
        break
      }
    };

    lines.forEach(line => {
      line = line.replace(/\u200E/g, '')
      // const chatStart = line.match(/^\[(.*?)\] (.*?):/);
      const chatStart = line.match(/^\[(\d{2}\/\d{2}\/\d{2}, \d{2}\.\d{2}\.\d{2})] (.*?): (.*)/);
      if (chatStart) {
        // Process previous message if exists
        if (currentPerson) {

          const wordCount = countWords(currentMessage);
          if (!persons[currentPerson]) {
            persons[currentPerson] = {
              totalChats: 0,
              totalWords: 0,
              totalImages: 0,
              totalStickers: 0,
              totalVideos: 0,
              totalTexts: 0,
              isHighestChats: false,
              isHighestWords: false,
              isHighestStickers: false,
              isHighestImages: false,
              isHighestVideos: false,
              isHighestTexts: false,
            }
          }

          if (currentMessage.trim() === 'image omitted') {
            persons[currentPerson].totalImages = (persons[currentPerson].totalImages || 0) + 1;
          } else if (currentMessage.trim() === 'video omitted') {
            persons[currentPerson].totalVideos = (persons[currentPerson].totalVideos || 0) + 1;
          } else if (currentMessage.trim() === 'sticker omitted') {
            persons[currentPerson].totalStickers = (persons[currentPerson].totalStickers || 0) + 1;
          } else {
            totalWords += wordCount;
            persons[currentPerson].totalTexts = (persons[currentPerson].totalTexts || 0) + 1;
            persons[currentPerson].totalWords = (persons[currentPerson].totalWords || 0) + wordCount;
          }

          persons[currentPerson].totalChats = (persons[currentPerson].totalChats || 0) + 1;

          allMessages += currentMessage;
          messages.push({
            message: currentMessage,
            sender: currentPerson,
          });
        }

        const [, timestamp, person] = chatStart;
        const date = extractDate(timestamp);
        const hour = extractHour(timestamp);
        const weekday = getWeekday(date);

        currentMessage = line.substring(line.indexOf(':') + 1).trim() + ' ';
        if (currentMessage.trim() === 'Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.') {
          currentPerson = '';
          currentMessage = '';
          allMessages = '';
          return
        }

        if (isGroup && (person.trim() === ignoredName.trim())) {
          currentPerson = '';
          currentMessage = '';
          allMessages = '';
          return
        }

        totalChats++;
        currentPerson = person;

        // Update daily stats
        if (!dailyChats[date]) {
          dailyChats[date] = { total: 0, byPerson: {} };
        }
        dailyChats[date].total++;
        dailyChats[date].byPerson[person] = (dailyChats[date].byPerson[person] || 0) + 1;

        // Update hourly stats
        if (!hourlyChats[hour]) {
          hourlyChats[hour] = { total: 0, byPerson: {} };
        }
        hourlyChats[hour].total++;
        hourlyChats[hour].byPerson[person] = (hourlyChats[hour].byPerson[person] || 0) + 1;

        // Update weekday stats
        weekdayChats[weekday].total++;
        weekdayChats[weekday].byPerson[person] = (weekdayChats[weekday].byPerson[person] || 0) + 1;
      } else {
        // Continuation of the previous message
        currentMessage += line.trim() + ' ';
      }
    });

    // Process the last message
    messages.push({
      message: currentMessage,
      sender: currentPerson,
    })

    if (currentPerson) {
      const wordCount = countWords(currentMessage);
      if (!persons[currentPerson]) {
        persons[currentPerson] = {
          totalChats: 0,
          totalWords: 0,
          totalImages: 0,
          totalStickers: 0,
          totalVideos: 0,
          totalTexts: 0,
          isHighestChats: false,
          isHighestWords: false,
          isHighestStickers: false,
          isHighestImages: false,
          isHighestVideos: false,
          isHighestTexts: false,
        }
      }
      if (currentMessage.trim() === 'image omitted') {
        persons[currentPerson].totalImages = (persons[currentPerson].totalImages || 0) + 1;
      } else if (currentMessage.trim() === 'video omitted') {
        persons[currentPerson].totalVideos = (persons[currentPerson].totalVideos || 0) + 1;
      } else if (currentMessage.trim() === 'sticker omitted') {
        persons[currentPerson].totalStickers = (persons[currentPerson].totalStickers || 0) + 1;
      } else {
        totalWords += wordCount;
        persons[currentPerson].totalTexts = (persons[currentPerson].totalTexts || 0) + 1;
        persons[currentPerson].totalWords = (persons[currentPerson].totalWords || 0) + wordCount;
      }

      persons[currentPerson].totalChats = (persons[currentPerson].totalChats || 0) + 1;
    }

    const chatStats = {
      totalChats,
      totalWords,
      persons,
      dailyChats,
      hourlyChats,
      weekdayChats,
    }

    const dataWeeklyPerPerson = transformDataWeeklyPerPerson(chatStats);
    const dataHourlyPerPerson = transformDataHourlyPerPerson(chatStats);
    const dataTotalPerDay = transformDataTotalPerDay(chatStats);

    setHighestFields(chatStats)

    setChartData({
      dataWeeklyPerPerson,
      dataHourlyPerPerson,
      dataTotalPerDay
    });

    setStats(chatStats);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const txtFiles = Object.keys(contents.files).filter(filename => filename.endsWith('.txt'));

        if (txtFiles.length === 0) {
          throw new Error('No .txt file found in the ZIP archive');
        }

        const txtFile = txtFiles[0];
        const text = await contents.file(txtFile)?.async('string');

        if (text) {
          analyzeText(text);
        } else {
          throw new Error('Failed to read the .txt file from the ZIP archive');
        }
      } else if (file.name.endsWith('.txt')) {
        const text = await file.text();
        analyzeText(text);
      } else {
        throw new Error('Unsupported file type. Please upload a .zip file containing a .txt file or a .txt file directly.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const optionWeeklyPerPerson = {
    chart: {
      id: 'weekly-per-person',
      toolbar: {
        show: false
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    }
  }

  const optionHourlyPerPerson = {
    chart: {
      id: 'hourly-per-person',
      toolbar: {
        show: false
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23']
    }
  }

  const optionTotalByTime: ApexOptions = {
    chart: {
      id: 'total-by-time',
      toolbar: {
        show: false
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      type: 'datetime',
    }
  }

  function setHighestFields(chatStats: ChatStats): void {
    // Initialize max values
    let maxChats = 0, maxWords = 0, maxStickers = 0, maxImages = 0, maxVideos = 0, maxTexts = 0;
  
    // Step 1: Find the maximum value for each stat
    Object.values(chatStats.persons).forEach((person) => {
      maxChats = Math.max(maxChats, person.totalChats);
      maxWords = Math.max(maxWords, person.totalWords);
      maxStickers = Math.max(maxStickers, person.totalStickers);
      maxImages = Math.max(maxImages, person.totalImages);
      maxVideos = Math.max(maxVideos, person.totalVideos);
      maxTexts = Math.max(maxTexts, person.totalTexts);
    });
  
    // Step 2: Set the isHighest... fields based on the max values
    Object.entries(chatStats.persons).forEach(([personName, person]) => {
      person.isHighestChats = person.totalChats === maxChats;
      person.isHighestWords = person.totalWords === maxWords;
      person.isHighestStickers = person.totalStickers === maxStickers;
      person.isHighestImages = person.totalImages === maxImages;
      person.isHighestVideos = person.totalVideos === maxVideos;
      person.isHighestTexts = person.totalTexts === maxTexts;
    });
  }

  function getUnixTimestamp(dateString: string): number {
    // Split the date string into day, month, and year
    const [day, month, year] = dateString.split('/').map(Number);
  
    // Assume that years 00-99 refer to 2000-2099
    const fullYear = year + 2000;
  
    // Create a Date object (month is 0-indexed in JavaScript)
    const date = new Date(fullYear, month - 1, day);
  
    // Get the Unix timestamp (in milliseconds) and convert to seconds
    return Math.floor(date.getTime());
  }

  function transformDataTotalPerDay(chatStats: ChatStats): TotalPerDay[] {
    const total: Total[] = []
    const totalPerDay: TotalPerDay[] = []

    Object.entries(chatStats.dailyChats).forEach(([date, dailyStats]) => {
      total.push({
        x: getUnixTimestamp(date),
        y: dailyStats.total
      })

    });

    const real: TotalPerDay = {
      data: total
    }

    totalPerDay.push(real)

    return totalPerDay
  }

  function transformDataWeeklyPerPerson(chatStats: ChatStats): TotalPerPerson[] {
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const personMap = new Map<string, number[]>();
  
    // Initialize personMap with empty arrays for each person
    weekdays.forEach(day => {
      const persons = Object.keys(chatStats.weekdayChats[day]?.byPerson || {});
      persons.forEach(person => {
        if (!personMap.has(person)) {
          personMap.set(person, new Array(7).fill(0));
        }
      });
    });
  
    // Fill in the data for each person
    weekdays.forEach((day, index) => {
      const dayStats = chatStats.weekdayChats[day];
      if (dayStats) {
        Object.entries(dayStats.byPerson).forEach(([person, count]) => {
          const personData = personMap.get(person);
          if (personData) {
            personData[index] = count;
          }
        });
      }
    });
  
    // Convert the Map to the desired array format
    return Array.from(personMap, ([name, data]) => ({ name, data }));
  }

  function transformDataHourlyPerPerson(chatStats: ChatStats): TotalPerPerson[] {
    const weekdays = ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'];
    const personMap = new Map<string, number[]>();
  
    // Initialize personMap with empty arrays for each person
    weekdays.forEach(hour => {
      const persons = Object.keys(chatStats.hourlyChats[hour]?.byPerson || {});
      persons.forEach(person => {
        if (!personMap.has(person)) {
          personMap.set(person, new Array(24).fill(0));
        }
      });
    });
  
    // Fill in the data for each person
    weekdays.forEach((hour, index) => {
      const hourStats = chatStats.hourlyChats[hour];
      if (hourStats) {
        Object.entries(hourStats.byPerson).forEach(([person, count]) => {
          const personData = personMap.get(person);
          if (personData) {
            personData[index] = count;
          }
        });
      }
    });
  
    // Convert the Map to the desired array format
    return Array.from(personMap, ([name, data]) => ({ name, data }));
  }

  return (
    <div data-theme="light" className="min-h-screen ">

    <div className="navbar border shadow-sm bg-base-100">
      <div className="navbar-start">
        {/* <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </div>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
            <li><a>Homepage</a></li>
            <li><a>Portfolio</a></li>
            <li><a>About</a></li>
          </ul>
        </div> */}
      </div>
      <div className="navbar-center">
        <a className="btn btn-ghost text-xl">Whatsapp Chat Analyzer</a>
      </div>
      <div className="navbar-end">
        {/* <button className="btn btn-ghost btn-circle">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <button className="btn btn-ghost btn-circle">
          <div className="indicator">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="badge badge-xs badge-primary indicator-item"></span>
          </div>
        </button> */}
      </div>
    </div>

      <div className="relative py-3">
        <div className="relative px-4 py-10 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                {/* <h2 className="text-2xl font-bold">WhatsApp Chat Analyzer</h2> */}
                <input
                  type="file"
                  accept=".zip,.txt"
                  onChange={handleFileChange}
                  className="file-input file-input-bordered file-input-sm w-full"
                />
                <button
                  onClick={handleUpload}
                  className="w-full py-2 px-4 btn btn-neutral"
                >
                  Upload and Analyze
                </button>
              </div>

              {error && (
                <div className="py-4 text-red-500">
                  {error}
                </div>
              )}

              {(stats && chartData) && (

                <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">

                <div className="stats shadow flex max-w-full">
                  <div className="stat place-items-center">
                    <div className="stat-title">Total Chats</div>
                    <div className="stat-value">{formatNumber(stats.totalChats)}</div>
                  </div>

                  <div className="stat place-items-center">
                    <div className="stat-title">Total Words</div>
                    <div className="stat-value">{formatNumber(stats.totalWords)}</div>
                  </div>
                </div>
            
                <div className="overflow-x-auto">
                  <table className="table">
                    {/* head */}
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Total Words</th>
                        <th>Total Chats</th>
                        <th>Texts</th>
                        <th>Images</th>
                        <th>Videos</th>
                        <th>Stickers</th>
                      </tr>
                    </thead>
                    <tbody>

                      {Object.entries(stats.persons).map(([person, stats]) => (
                        <tr key={person}>
                          <td>{person}</td>

                          {stats.isHighestWords && stats.totalWords > 0 ? (
                            <td className='bg-green-400 text-white font-semibold text-center'>{formatNumber(stats.totalWords)}</td>
                          ) : (
                            <td className='text-center'>{formatNumber(stats.totalWords)}</td>
                          )}

                          {stats.isHighestChats && stats.totalChats > 0 ? (
                            <td className='bg-green-400 text-white font-semibold text-center'>{formatNumber(stats.totalChats)}</td>
                          ) : (
                            <td className='text-center'>{formatNumber(stats.totalChats)}</td>
                          )}

                          {stats.isHighestTexts && stats.totalTexts > 0 ? (
                            <td className='bg-green-400 text-white font-semibold text-center'>{formatNumber(stats.totalTexts)}</td>
                          ) : (
                            <td className='text-center'>{formatNumber(stats.totalTexts)}</td>
                          )}

                          {stats.isHighestImages && stats.totalImages > 0 ? (
                            <td className='bg-green-400 text-white font-semibold text-center'>{formatNumber(stats.totalImages)}</td>
                          ) : (
                            <td className='text-center'>{formatNumber(stats.totalImages)}</td>
                          )}

                          {stats.isHighestVideos && stats.totalVideos > 0 ? (
                            <td className='bg-green-400 text-white font-semibold text-center'>{formatNumber(stats.totalVideos)}</td>
                          ) : (
                            <td className='text-center'>{formatNumber(stats.totalVideos)}</td>
                          )}

                          {stats.isHighestStickers && stats.totalStickers > 0 ? (
                            <td className='bg-green-400 text-white font-semibold text-center'>{formatNumber(stats.totalStickers)}</td>
                          ) : (
                            <td className='text-center'>{formatNumber(stats.totalStickers)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <hr />
                  
                  <h2 className="font-semibold">Total Chats By Day</h2>
                  <ApexChart type="bar" options={optionWeeklyPerPerson} series={chartData.dataWeeklyPerPerson} />

                  <h2 className="font-semibold">Total Chats By Hour</h2>
                  <ApexChart type="bar" options={optionHourlyPerPerson} series={chartData.dataHourlyPerPerson} />

                  <h2 className="font-semibold">Total Chats Over Time</h2>
                  <ApexChart type="bar" options={optionTotalByTime} series={chartData.dataTotalPerDay} />

                </div>
                
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}