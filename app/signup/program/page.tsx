"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SiteHeader } from "@/components/site-header"

export default function ProgramInfoPage() {
  const router = useRouter()
  const [error, setError] = useState("")

  // Program Information
  const [sportType, setSportType] = useState("")
  const [programType, setProgramType] = useState("")
  const [schoolName, setSchoolName] = useState("")
  const [city, setCity] = useState("")
  const [teamName, setTeamName] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#1e3a5f")
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF")

  // Load from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem("signupData")
    if (saved) {
      const data = JSON.parse(saved)
      setSportType(data.sportType || "")
      setProgramType(data.programType || "")
      setSchoolName(data.schoolName || "")
      setCity(data.city || "")
      setTeamName(data.teamName || "")
      setPrimaryColor(data.primaryColor || "#1e3a5f")
      setSecondaryColor(data.secondaryColor || "#FFFFFF")
    }
  }, [])

  const handleContinue = () => {
    setError("")

    if (!sportType || !programType || !teamName || !primaryColor || !secondaryColor) {
      setError("Please fill in all required fields")
      return
    }

    if (programType === "high-school" || programType === "collegiate") {
      if (!schoolName) {
        setError("Please enter a school name")
        return
      }
    } else if (programType === "youth") {
      if (!city) {
        setError("Please enter a city of operation")
        return
      }
    }

    // Save to localStorage
    const saved = localStorage.getItem("signupData")
    const signupData = saved ? JSON.parse(saved) : {}
    signupData.sportType = sportType
    signupData.programType = programType
    signupData.schoolName = schoolName
    signupData.city = city
    signupData.teamName = teamName
    signupData.primaryColor = primaryColor
    signupData.secondaryColor = secondaryColor
    localStorage.setItem("signupData", JSON.stringify(signupData))

    // Navigate to payment page
    router.push("/signup/payment")
  }

  const handleBack = () => {
    router.push("/signup")
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div className="w-full max-w-2xl mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-athletic font-bold text-center mb-2 text-[#212529] uppercase tracking-tight">
                Program Information
              </h2>
              <p className="text-center text-[#495057]">
                Step 2 of 3 - Program Setup
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sportType" className="text-sm font-medium text-[#495057]">Sport Type *</Label>
                  <select
                    id="sportType"
                    value={sportType}
                    onChange={(e) => setSportType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    required
                  >
                    <option value="">Select sport</option>
                    <option value="football">Football</option>
                    <option value="basketball">Basketball</option>
                    <option value="baseball">Baseball</option>
                    <option value="softball">Softball</option>
                    <option value="soccer">Soccer</option>
                    <option value="hockey">Hockey</option>
                    <option value="lacrosse">Lacrosse</option>
                    <option value="volleyball">Volleyball</option>
                    <option value="wrestling">Wrestling</option>
                    <option value="track">Track & Field</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="programType" className="text-sm font-medium text-[#495057]">Program Type *</Label>
                  <select
                    id="programType"
                    value={programType}
                    onChange={(e) => {
                      setProgramType(e.target.value)
                      setSchoolName("")
                      setCity("")
                    }}
                    className="flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    required
                  >
                    <option value="">Select program type</option>
                    <option value="high-school">High School Program</option>
                    <option value="collegiate">Collegiate Program</option>
                    <option value="youth">Youth Sports Program</option>
                  </select>
                </div>

                {(programType === "high-school" || programType === "collegiate") && (
                  <div className="space-y-2">
                    <Label htmlFor="schoolName" className="text-sm font-medium text-[#495057]">School Name *</Label>
                    <Input
                      id="schoolName"
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                      placeholder="Enter school name"
                      required
                    />
                  </div>
                )}

                {programType === "youth" && (
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-sm font-medium text-[#495057]">City of Operation *</Label>
                    <Input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                      placeholder="Enter city"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="teamName" className="text-sm font-medium text-[#495057]">Team Name *</Label>
                  <Input
                    id="teamName"
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                    placeholder="Enter team name"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor" className="text-sm font-medium text-[#495057]">Primary Color *</Label>
                    <div className="flex items-center gap-4">
                      <input
                        id="primaryColor"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-10 w-20 rounded border border-[#E5E7EB] bg-white cursor-pointer"
                        required
                      />
                      <Input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="bg-white text-[#212529] placeholder:text-[#6c757d] flex-1"
                        placeholder="#1e3a5f"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor" className="text-sm font-medium text-[#495057]">Secondary Color *</Label>
                    <div className="flex items-center gap-4">
                      <input
                        id="secondaryColor"
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="h-10 w-20 rounded border border-[#E5E7EB] bg-white cursor-pointer"
                        required
                      />
                      <Input
                        type="text"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="bg-white text-[#212529] placeholder:text-[#6c757d] flex-1"
                        placeholder="#FFFFFF"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-white bg-[#EF4444] border border-[#EF4444] rounded-lg p-3 font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1 bg-white border-[#E5E7EB] text-[#212529] hover:bg-[#F9FAFB]"
                >
                  Back
                </Button>
                <Button 
                  type="button"
                  onClick={handleContinue}
                  className="flex-1 font-athletic uppercase tracking-wide" 
                  size="lg"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
