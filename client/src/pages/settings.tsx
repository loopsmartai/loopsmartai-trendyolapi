import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Helper for generating numbers in a range
const generateRange = (start: number, end: number, step: number = 1) => {
  const range = [];
  for (let i = start; i <= end; i += step) {
    range.push(i.toString().padStart(2, "0")); // Ensures values are zero-padded
  }
  return range;
};

const Settings = () => {
  const [loading, setLoading] = useState(true); // Tracks loading state
  const [automaticAnswer, setAutomaticAnswer] = useState(false); // Tracks if checkbox is enabled
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState({ hour: "08", minute: "00" }); // Default start time
  const [endTime, setEndTime] = useState({ hour: "17", minute: "00" }); // Default end time
  const [isSaveDisabled, setIsSaveDisabled] = useState(true); // Tracks save button state

  // Fetch settings from the API when the component loads
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get("/api/settings"); // Replace with your API endpoint
        const data = response.data;

        // Populate form fields with data from the API
        setAutomaticAnswer(data.automaticAnswer || false);
        setSelectedWeekdays(data.weekdays || []);
        const [startHour, startMinute] = (data.startTime || "08:00").split(":");
        const [endHour, endMinute] = (data.endTime || "17:00").split(":");
        setStartTime({ hour: startHour, minute: startMinute });
        setEndTime({ hour: endHour, minute: endMinute });
      } catch (error) {
        console.error("Error fetching settings:", error);
        alert("Failed to load settings. Please try again later.");
      } finally {
        setLoading(false); // Disable loading state after fetching
      }
    };

    fetchSettings();
  }, []);

  // Whenever any form data changes, enable the save button
  useEffect(() => {
    const formDataChanged = (prevSettings: any) => {
      return (
        prevSettings.automaticAnswer !== automaticAnswer ||
        prevSettings.weekdays.sort().toString() !==
          selectedWeekdays.sort().toString() ||
        prevSettings.startTime !== `${startTime.hour}:${startTime.minute}` ||
        prevSettings.endTime !== `${endTime.hour}:${endTime.minute}`
      );
    };

    const checkIfFormDataChanged = async () => {
      try {
        const response = await axios.get("/api/settings"); // Fetch existing settings data
        const existingSettings = response.data;
        const hasChanged = formDataChanged(existingSettings);
        setIsSaveDisabled(!hasChanged); // Enable/disable save button based on data change
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    checkIfFormDataChanged();
  }, [automaticAnswer, selectedWeekdays, startTime, endTime]);

  // Handle weekday checkbox selection
  const handleWeekdaysChange = (day: string) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      automaticAnswer,
      weekdays: selectedWeekdays,
      startTime: `${startTime.hour}:${startTime.minute}`,
      endTime: `${endTime.hour}:${endTime.minute}`,
    };

    try {
      // Send form data to the backend
      await axios.post("/api/settings", data);
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    }
  };

  if (loading) {
    return <div className="p-4">Loading settings...</div>; // Show a loading indicator
  }

  return (
    <div className="min-h-screen p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Automatic Answer Settings</CardTitle>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to List
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Automatic Answer Checkbox */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={automaticAnswer}
                  onChange={(e) => setAutomaticAnswer(e.target.checked)}
                />
                <span>Enable Automatic Answer</span>
              </label>
            </div>

            {/* Conditionally Show Components if Automatic Answer Enabled */}
            {automaticAnswer && (
              <div className="space-y-4">
                {/* Weekdays Selection */}
                <div>
                  <p className="font-medium">Select Weekdays:</p>
                  <div className="flex space-x-2">
                    {weekdays.map((day) => (
                      <label key={day} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedWeekdays.includes(day)}
                          onChange={() => handleWeekdaysChange(day)}
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Time Range Selection */}
                <div>
                  <p className="font-medium">Select Time Range:</p>
                  <div className="flex items-center space-x-4">
                    {/* Start Time */}
                    <div>
                      <label className="font-medium">Start Time:</label>
                      <div className="flex space-x-2 mt-1">
                        <select
                          value={startTime.hour}
                          onChange={(e) =>
                            setStartTime((prev) => ({
                              ...prev,
                              hour: e.target.value,
                            }))
                          }
                          className="border p-1 rounded"
                        >
                          {generateRange(0, 23).map((hour) => (
                            <option key={hour} value={hour}>
                              {hour}
                            </option>
                          ))}
                        </select>
                        <select
                          value={startTime.minute}
                          onChange={(e) =>
                            setStartTime((prev) => ({
                              ...prev,
                              minute: e.target.value,
                            }))
                          }
                          className="border p-1 rounded"
                        >
                          {generateRange(0, 55, 5).map((minute) => (
                            <option key={minute} value={minute}>
                              {minute}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* End Time */}
                    <div>
                      <label className="font-medium">End Time:</label>
                      <div className="flex space-x-2 mt-1">
                        <select
                          value={endTime.hour}
                          onChange={(e) =>
                            setEndTime((prev) => ({
                              ...prev,
                              hour: e.target.value,
                            }))
                          }
                          className="border p-1 rounded"
                        >
                          {generateRange(0, 23).map((hour) => (
                            <option key={hour} value={hour}>
                              {hour}
                            </option>
                          ))}
                        </select>
                        <select
                          value={endTime.minute}
                          onChange={(e) =>
                            setEndTime((prev) => ({
                              ...prev,
                              minute: e.target.value,
                            }))
                          }
                          className="border p-1 rounded"
                        >
                          {generateRange(0, 55, 5).map((minute) => (
                            <option key={minute} value={minute}>
                              {minute}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}

            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
              disabled={isSaveDisabled}
            >
              Save
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
