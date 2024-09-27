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

interface TotalData {
  data: Total[];
}

interface Total {
  x: number;
  y: number;
}

interface TotalDataString {
  data: TotalString[];
}

interface TotalString {
  x: string;
  y: number;
}

interface ChartData {
  dataDaily: TotalDataString[];
  dataDailyPerPerson: TotalPerPerson[];
  dataHourly: TotalDataString[];
  dataHourlyPerPerson: TotalPerPerson[];
  dataTotalPerDay: TotalData[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisibleUploadBox, setIsVisibleUploadBox] = useState(true);
  const [isVisibleResult, setIsVisibleResult] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError(null);
      handleUpload(e.target.files[0]);
    }
  };

  const toggleVisibility = () => {
    setIsVisibleUploadBox(!isVisibleUploadBox);
    setIsVisibleResult(!isVisibleResult);
  }

  const toggleVisibilityUploadBox = () => {
    setIsVisibleUploadBox(!isVisibleUploadBox);
  };

  const toggleVisibilityResult = () => {
    setIsVisibleResult(!isVisibleResult);
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

    const dataDaily = transformDataDaily(chatStats);
    const dataDailyPerPerson = transformDataDailyPerPerson(chatStats);
    const dataHourly = transformDataHourly(chatStats);
    const dataHourlyPerPerson = transformDataHourlyPerPerson(chatStats);
    const dataTotalPerDay = transformDataTotalPerDay(chatStats);

    setHighestFields(chatStats)

    setChartData({
      dataDaily,
      dataDailyPerPerson,
      dataHourly,
      dataHourlyPerPerson,
      dataTotalPerDay
    });

    setStats(chatStats);
    toggleVisibilityUploadBox();
    toggleVisibilityResult();
  };

  const handleUpload = async (file: File) => {
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

  const optionDaily = {
    chart: {
      id: 'daily',
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

  const optionDailyPerPerson = {
    chart: {
      id: 'daily-per-person',
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

  const optionHourly = {
    chart: {
      id: 'hourly',
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

  function transformDataTotalPerDay(chatStats: ChatStats): TotalData[] {
    const total: Total[] = []
    const totalPerDay: TotalData[] = []

    Object.entries(chatStats.dailyChats).forEach(([date, dailyStats]) => {
      total.push({
        x: getUnixTimestamp(date),
        y: dailyStats.total
      })

    });

    const real: TotalData = {
      data: total
    }

    totalPerDay.push(real)

    return totalPerDay
  }

  function transformDataDaily(chatStats: ChatStats): TotalDataString[] {
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const totalPerDay: TotalDataString[] = []

    const result: TotalDataString = { data: [] };

    weekdays.forEach(hour => {
      const data = chatStats.weekdayChats[hour]
      let tot = 0
      if (data === undefined || data === null) {
        tot = 0
      } else {
        tot = data.total
      }
      result.data.push({
        x: hour,
        y: tot
      })
    })

    totalPerDay.push(result)
  
    return totalPerDay
  }
  
  function transformDataDailyPerPerson(chatStats: ChatStats): TotalPerPerson[] {
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

  function transformDataHourly(chatStats: ChatStats): TotalDataString[] {
    const weekdays = ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'];
    const totalPerDay: TotalDataString[] = []

    const result: TotalDataString = { data: [] };

    weekdays.forEach(hour => {
      const data = chatStats.hourlyChats[hour]
      let tot = 0
      if (data === undefined || data === null) {
        tot = 0
      } else {
        tot = data.total
      }
      result.data.push({
        x: hour,
        y: tot
      })
    })

    totalPerDay.push(result)
  
    return totalPerDay
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

  <div className="h-screen flex flex-col pb-6">

    {/* Header & Description */}
    <div className="mt-20 max-w-4xl w-full text-center mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-800 sm:text-4xl">
        Chat Analyzer
      </h1>
      <p className="mt-3 text-gray-600">
        Explore your chat data through numbers and charts
      </p>
    </div>

    {/* Upload Box */}
    {isVisibleUploadBox ? 
    
      (<div className="mt-5 max-w-2xl w-full mx-auto px-4">

        {/* Callout */}
        <div id="alert-additional-content-5" className="p-4 border border-gray-300 rounded-lg bg-gray-50 mb-5 text-xs" role="alert">
          <div className="flex">
            <svg className="flex-shrink-0 w-4 h-4 me-2 " aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
            </svg>
            <div className="text-gray-800 ">
              At present, our service is limited to WhatsApp conversations, but we are working on incorporating other messaging apps soon, such as Telegram, Discord, etc.
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-8 rounded-xl shadow-xl border border-gray-100">
        <div className="flex items-center">

          {/* Tab */}
          <div role="tablist" className="tabs tabs-bordered w-full">
            <input type="radio" name="my_tabs_1" role="tab" className="tab" aria-label="WhatsApp" defaultChecked/>
            <div role="tabpanel" className="tab-content">

                <label htmlFor="dropzone-file" className="mt-5 flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    <p className="mb-2 text-sm text-gray-500 text-center"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-gray-500 text-center">Whatsapp chat history data in .zip or .txt format</p>
                  </div>
                  <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".zip,.txt"/>
                </label>
              
            </div>

            <input type="radio" name="my_tabs_1" role="tab" className="tab" aria-label="Telegram" disabled />
            <div role="tabpanel" className="tab-content py-2">
              tes bos
            </div>

            <input type="radio" name="my_tabs_1" role="tab" className="tab" aria-label="Discord" disabled />
            <div role="tabpanel" className="tab-content py-2">
              tes bos
            </div>

            {/* <input type="radio" name="my_tabs_1" role="tab" className="tab" aria-label="How to Export Chat Data" />
            <div role="tabpanel" className="tab-content p-10">Tab content 3</div> */}
          </div>

        </div>

        </div>
        <p className="mt-7 text-gray-400 text-xs italic text-center">
          Your chat data is processed securely in your own browser and never stored in our servers or anywhere else
        </p>
      </div>) : 
    
      (<div className="mt-10 max-w-lg w-full mx-auto px-4 flex justify-center">
          <button onClick={toggleVisibility} className="text-white bg-gray-600 hover:bg-gray-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center ">
            Upload a new data

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="rtl:rotate-180 w-3.5 h-3.5 ms-2">
              <path strokeLinecap="round" stroke-width="3" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>

          </button>
      </div>)
    }

    {/* Visualization */}
    {isVisibleResult && 
      (<div className="relative px-4 bg-white">
        <div className="px-10 mx-auto">

            {error && (
              <div className="py-4 text-red-500 text-center">
                {error}
              </div>
            )}

            {(stats && chartData) && (

              <div>

              {/* Chat Statistics */}
              <div className="flex justify-center mb-12">
                <div className="max-w-4xl text-base leading-6 space-y-4 text-gray-700">
                  {/* <div className="relative flex py-5 items-center">
                      <div className="flex-grow border-t border-gray-200"></div>
                      <span className="flex-shrink mx-4 text-gray-600">Chat Statistics</span>
                      <div className="flex-grow border-t border-gray-200"></div>
                  </div> */}

                  <div className="stats shadow flex max-w-full mt-10">
                    <div className="stat place-items-center">
                      <div className="stat-title">Total Words</div>
                      <div className="stat-value text-gray-600">{formatNumber(stats.totalWords)}</div>
                    </div>

                    <div className="stat place-items-center">
                      <div className="stat-title">Total Chats</div>
                      <div className="stat-value text-gray-600">{formatNumber(stats.totalChats)}</div>
                    </div>
                  </div>
              
                  <div className="overflow-x-auto border border-gray-100 rounded-xl shadow">
                    <table className="table">
                      {/* head */}
                      <thead className="bg-gray-600">
                        <tr className="text-gray-50">
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
                            <td className='font-semibold'>{person}</td>

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
                </div>
              </div>
              
              {/* Chat Visualizations */}
              <div className="grid grid-cols-12 gap-6">

                {/* Row 1 */}
                <div className="col-span-12 lg:col-span-1 xl:col-span-1">
                </div>

                <div className="col-span-12 lg:col-span-5 xl:col-span-5 hover:rounded-xl hover:shadow-xl p-4 transition delay-50 duration-150 ease-in-out border border-gray-100 rounded-xl">
                  <h2 className="font-semibold">Total Chats By Day</h2>
                  <ApexChart type="bar" options={optionDaily} series={chartData.dataDaily} />
                </div>

                <div className="col-span-12 lg:col-span-5 xl:col-span-5 hover:rounded-xl hover:shadow-xl p-4 transition delay-50 duration-150 ease-in-out border border-gray-100 rounded-xl">
                  <h2 className="font-semibold">Total Chats By Day (per Person)</h2>
                  <ApexChart type="bar" options={optionDailyPerPerson} series={chartData.dataDailyPerPerson} />
                </div>

                <div className="col-span-12 lg:col-span-1 xl:col-span-1">
                </div>

                {/* Row 2 */}
                <div className="col-span-12 lg:col-span-1 xl:col-span-1">
                </div>

                <div className="col-span-12 lg:col-span-5 xl:col-span-5 hover:rounded-xl hover:shadow-xl p-4 transition delay-50 duration-150 ease-in-out border border-gray-100 rounded-xl">
                  <h2 className="font-semibold">Total Chats By Hour</h2>
                  <ApexChart type="bar" options={optionHourly} series={chartData.dataHourly} />
                </div>

                <div className="col-span-12 lg:col-span-5 xl:col-span-5 hover:rounded-xl hover:shadow-xl p-4 transition delay-50 duration-150 ease-in-out border border-gray-100 rounded-xl">
                  <h2 className="font-semibold">Total Chats By Hour (per Person)</h2>
                  <ApexChart type="bar" options={optionHourlyPerPerson} series={chartData.dataHourlyPerPerson} />
                </div>

                <div className="col-span-12 lg:col-span-1 xl:col-span-1">
                </div>

                {/* Row 3 */}
                <div className="col-span-12 lg:col-span-1 xl:col-span-1">
                </div>

                <div className="col-span-12  lg:col-span-10 xl:col-span-10 hover:rounded-xl hover:shadow-xl p-4 transition delay-50 duration-150 ease-in-out border border-gray-100 rounded-xl">
                    <h2 className="font-semibold">Total Chats Over Time</h2>
                    <ApexChart type="bar" options={optionTotalByTime} series={chartData.dataTotalPerDay} height={400} />
                </div>

                <div className="col-span-12 lg:col-span-1 xl:col-span-1">
                </div>

              </div>

            </div>
            )}

        </div>
      </div>)
    }

    {/* Footer */}
    <footer className="mt-auto max-w-4xl text-center mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <p className="text-xs text-gray-600"></p>
    </footer>

  </div>
  );
}