import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Calculator, Printer, RefreshCw } from "lucide-react";
import soapCalcOilsData from "../data/soapcalc_oils.json";

// Types matching the extracted data structure
interface OilData {
  id: number;
  name: string;
  sap: number; // NaOH SAP
  iodine: number;
  ins: number;
  lauric: number;
  myristic: number;
  palmitic: number;
  stearic: number;
  ricinoleic: number;
  oleic: number;
  linoleic: number;
  linolenic: number;
}

interface SelectedOil {
  oilId: number;
  amount: number; // in the selected unit (g, oz, lb)
  percentage: number;
}

interface SoapQualities {
  hardness: number;
  cleansing: number;
  conditioning: number;
  bubbly: number;
  creamy: number;
  iodine: number;
  ins: number;
}

interface FattyAcids {
  lauric: number;
  myristic: number;
  palmitic: number;
  stearic: number;
  ricinoleic: number;
  oleic: number;
  linoleic: number;
  linolenic: number;
}

const SoapCalcReplica = () => {
  // --- State: Step 1: Lye Type ---
  const [lyeType, setLyeType] = useState<"NaOH" | "KOH" | "KOH90">("NaOH");

  // --- State: Step 2: Weight of Oils ---
  const [weightUnit, setWeightUnit] = useState<"lb" | "oz" | "g">("lb");
  const [totalOilWeight, setTotalOilWeight] = useState<number>(1);

  // --- State: Step 3: Water ---
  const [waterCalculationMethod, setWaterCalculationMethod] = useState<"percentOfOils" | "lyeConcentration" | "waterLyeRatio">("percentOfOils");
  const [waterPercentOfOils, setWaterPercentOfOils] = useState<number>(38);
  const [lyeConcentration, setLyeConcentration] = useState<number>(33); // Default typical value
  const [waterLyeRatio, setWaterLyeRatio] = useState<number>(2); // Default 2:1

  // --- State: Step 4: Superfat & Fragrance ---
  const [superfat, setSuperfat] = useState<number>(5);
  const [fragranceRatio, setFragranceRatio] = useState<number>(0.5); // oz per lb of oil

  // --- State: Step 5: Soap Qualities (Calculated) ---
  // We calculate these on the fly based on selected oils

  // --- State: Step 6: Recipe Oil List ---
  const [selectedOils, setSelectedOils] = useState<SelectedOil[]>([]);
  const [currentOilId, setCurrentOilId] = useState<string>("");
  const [currentOilAmount, setCurrentOilAmount] = useState<number>(0); // Can be weight or % depending on mode, but for simplicity we'll track weight primarily or allow user to input %

  // --- Calculation Results ---
  const [results, setResults] = useState<{
    lyeAmount: number;
    waterAmount: number;
    totalBatchWeight: number;
    fragranceAmount: number;
    qualities: SoapQualities;
    fattyAcids: FattyAcids;
    satRatio: number;
    unsatRatio: number;
  } | null>(null);

  // --- Helpers ---
  const getOilById = (id: number) => soapCalcOilsData.find((o) => o.id === id);

  const addOil = () => {
    if (!currentOilId) return;
    const id = parseInt(currentOilId);
    
    // Check if already added
    if (selectedOils.find(o => o.oilId === id)) {
      // Update existing? Or just alert? Let's just allow duplicates for now or ignore
      return;
    }

    // Default to 0 amount, user will adjust in table
    setSelectedOils([...selectedOils, { oilId: id, amount: 0, percentage: 0 }]);
    setCurrentOilId("");
  };

  const removeOil = (index: number) => {
    const newOils = [...selectedOils];
    newOils.splice(index, 1);
    setSelectedOils(newOils);
  };

  const updateOilAmount = (index: number, value: number, mode: "weight" | "percent") => {
    const newOils = [...selectedOils];
    if (mode === "weight") {
      newOils[index].amount = value;
      // Recalculate percentage
      // We need total weight to be accurate first. 
      // If we are in "weight mode", total weight is sum of all oils? 
      // SoapCalc allows setting total weight fixed, OR summing up.
      // Let's stick to SoapCalc logic: User sets Total Oil Weight in Step 2.
      // The individual weights should sum up to that, OR percentages sum to 100.
      newOils[index].percentage = (value / totalOilWeight) * 100;
    } else {
      newOils[index].percentage = value;
      newOils[index].amount = (value / 100) * totalOilWeight;
    }
    setSelectedOils(newOils);
  };

  // --- The Big Calculation Logic ---
  const calculateRecipe = () => {
    let totalLye = 0;
    let totalWater = 0;
    let totalFragrance = 0;
    
    // 1. Normalize Oil Weights
    // Ensure selected oils sum up to totalOilWeight if using percentages
    // Or if using weights, update totalOilWeight? 
    // SoapCalc usually respects the "Total Oil Weight" input and scales percentages to match.
    
    const currentTotalWeight = selectedOils.reduce((sum, oil) => sum + oil.amount, 0);
    const currentTotalPercent = selectedOils.reduce((sum, oil) => sum + oil.percentage, 0);

    // If percentages are used (sum close to 100), we recalculate amounts based on Total Oil Weight
    const oilsWithAmounts = selectedOils.map(oil => {
      const oilData = getOilById(oil.oilId);
      // If user entered percentages, prioritize that
      const calculatedAmount = (oil.percentage / 100) * totalOilWeight;
      
      if (!oilData) {
         // Return a dummy structure to satisfy TS, but filter it out later or handle gracefully
         return {
            ...oil,
            amount: calculatedAmount,
            data: {
              id: -1, name: "Unknown", sap: 0, iodine: 0, ins: 0, 
              lauric: 0, myristic: 0, palmitic: 0, stearic: 0, 
              ricinoleic: 0, oleic: 0, linoleic: 0, linolenic: 0
            }
         };
      }

      return {
        ...oil,
        amount: calculatedAmount,
        data: oilData
      };
    });

    // 2. Calculate Lye
    // SAP in JSON is NaOH SAP.
    // KOH SAP = NaOH SAP * 1.403
    // KOH 90% = KOH SAP / 0.9
    
    let requiredLye = 0;
    
    oilsWithAmounts.forEach(oil => {
      let sap = oil.data.sap;
      if (lyeType === "KOH") sap = sap * 1.403;
      if (lyeType === "KOH90") sap = (sap * 1.403) / 0.9;
      
      requiredLye += oil.amount * sap;
    });

    // Apply Superfat (Lye Discount)
    // Discount reduces the Lye amount
    requiredLye = requiredLye * (1 - (superfat / 100));

    // 3. Calculate Water
    if (waterCalculationMethod === "percentOfOils") {
      totalWater = totalOilWeight * (waterPercentOfOils / 100);
    } else if (waterCalculationMethod === "waterLyeRatio") {
      totalWater = requiredLye * waterLyeRatio;
    } else if (waterCalculationMethod === "lyeConcentration") {
      // Concentration = Lye / (Lye + Water)
      // Water = (Lye / Concentration) - Lye
      totalWater = (requiredLye / (lyeConcentration / 100)) - requiredLye;
    }

    // 4. Calculate Fragrance
    // Ratio is oz/lb of oil.
    // Need to convert totalOilWeight to lbs first if it's not
    let weightInLbs = totalOilWeight;
    if (weightUnit === "oz") weightInLbs = totalOilWeight / 16;
    if (weightUnit === "g") weightInLbs = totalOilWeight / 453.592;
    
    totalFragrance = weightInLbs * fragranceRatio;
    // Convert fragrance back to selected unit for display consistency? 
    // SoapCalc usually shows fragrance in oz. Let's keep it in oz for now or convert to selected unit.
    if (weightUnit === "g") totalFragrance = totalFragrance * 28.3495; // oz to g

    // 5. Calculate Qualities & Fatty Acids
    // Weighted average based on percentage
    const qualities = {
      hardness: 0, cleansing: 0, conditioning: 0, bubbly: 0, creamy: 0, iodine: 0, ins: 0
    };
    const fattyAcids = {
      lauric: 0, myristic: 0, palmitic: 0, stearic: 0, ricinoleic: 0, oleic: 0, linoleic: 0, linolenic: 0
    };

    oilsWithAmounts.forEach(oil => {
      const p = oil.percentage / 100;
      const d = oil.data;
      
      // SoapCalc Logic: Hardness = Lauric + Myristic + Palmitic + Stearic
      // But SoapCalc JSON has explicit Hardness? No, we have to calculate it from FAs usually, 
      // OR use the specific logic.
      // Actually, SoapCalc defines:
      // Hardness = Lauric + Myristic + Palmitic + Stearic
      // Cleansing = Lauric + Myristic
      // Conditioning = Ricinoleic + Oleic + Linoleic + Linolenic
      // Bubbly = Lauric + Myristic + Ricinoleic
      // Creamy = Palmitic + Stearic + Ricinoleic
      
      // Let's sum up FAs first
      fattyAcids.lauric += d.lauric * p;
      fattyAcids.myristic += d.myristic * p;
      fattyAcids.palmitic += d.palmitic * p;
      fattyAcids.stearic += d.stearic * p;
      fattyAcids.ricinoleic += d.ricinoleic * p;
      fattyAcids.oleic += d.oleic * p;
      fattyAcids.linoleic += d.linoleic * p;
      fattyAcids.linolenic += d.linolenic * p;

      // Iodine and INS are direct weighted averages
      qualities.iodine += d.iodine * p;
      qualities.ins += d.ins * p;
    });

    // Derived Qualities
    qualities.hardness = fattyAcids.lauric + fattyAcids.myristic + fattyAcids.palmitic + fattyAcids.stearic;
    qualities.cleansing = fattyAcids.lauric + fattyAcids.myristic;
    qualities.conditioning = fattyAcids.ricinoleic + fattyAcids.oleic + fattyAcids.linoleic + fattyAcids.linolenic;
    qualities.bubbly = fattyAcids.lauric + fattyAcids.myristic + fattyAcids.ricinoleic;
    qualities.creamy = fattyAcids.palmitic + fattyAcids.stearic + fattyAcids.ricinoleic;

    const satSum = fattyAcids.lauric + fattyAcids.myristic + fattyAcids.palmitic + fattyAcids.stearic;
    const unsatSum = fattyAcids.ricinoleic + fattyAcids.oleic + fattyAcids.linoleic + fattyAcids.linolenic;

    setResults({
      lyeAmount: requiredLye,
      waterAmount: totalWater,
      totalBatchWeight: totalOilWeight + requiredLye + totalWater + totalFragrance,
      fragranceAmount: totalFragrance,
      qualities,
      fattyAcids,
      satRatio: satSum,
      unsatRatio: unsatSum
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 font-sans text-stone-800">
      {/* Left Column: Inputs */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Step 1: Lye */}
        <Card className="border-t-4 border-t-emerald-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-serif text-emerald-900">1. Type of Lye</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={lyeType} onValueChange={(v: any) => setLyeType(v)} className="flex flex-col gap-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="NaOH" id="naoh" />
                <Label htmlFor="naoh">NaOH</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="KOH" id="koh" />
                <Label htmlFor="koh">KOH</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="KOH90" id="koh90" />
                <Label htmlFor="koh90">90% KOH</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Step 2: Weight */}
        <Card className="border-t-4 border-t-emerald-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-serif text-emerald-900">2. Oil Weight</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={weightUnit} onValueChange={(v: any) => setWeightUnit(v)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="lb" id="lb" />
                <Label htmlFor="lb">Pounds</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="oz" id="oz" />
                <Label htmlFor="oz">Ounces</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="g" id="g" />
                <Label htmlFor="g">Grams</Label>
              </div>
            </RadioGroup>
            <div className="flex items-center gap-2">
              <Label>Total Weight:</Label>
              <Input 
                type="number" 
                value={totalOilWeight} 
                onChange={(e) => setTotalOilWeight(parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">{weightUnit}</span>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Water */}
        <Card className="border-t-4 border-t-emerald-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-serif text-emerald-900">3. Water</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input 
                  type="radio" 
                  checked={waterCalculationMethod === "percentOfOils"} 
                  onChange={() => setWaterCalculationMethod("percentOfOils")}
                  className="accent-emerald-600"
                />
                <Label>% of Oils</Label>
              </div>
              <Input 
                type="number" 
                value={waterPercentOfOils} 
                onChange={(e) => setWaterPercentOfOils(parseFloat(e.target.value))}
                disabled={waterCalculationMethod !== "percentOfOils"}
                className="w-20 h-8"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input 
                  type="radio" 
                  checked={waterCalculationMethod === "lyeConcentration"} 
                  onChange={() => setWaterCalculationMethod("lyeConcentration")}
                  className="accent-emerald-600"
                />
                <Label>Lye Concentration %</Label>
              </div>
              <Input 
                type="number" 
                value={lyeConcentration} 
                onChange={(e) => setLyeConcentration(parseFloat(e.target.value))}
                disabled={waterCalculationMethod !== "lyeConcentration"}
                className="w-20 h-8"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input 
                  type="radio" 
                  checked={waterCalculationMethod === "waterLyeRatio"} 
                  onChange={() => setWaterCalculationMethod("waterLyeRatio")}
                  className="accent-emerald-600"
                />
                <Label>Water : Lye Ratio</Label>
              </div>
              <div className="flex items-center gap-1">
                <Input 
                  type="number" 
                  value={waterLyeRatio} 
                  onChange={(e) => setWaterLyeRatio(parseFloat(e.target.value))}
                  disabled={waterCalculationMethod !== "waterLyeRatio"}
                  className="w-16 h-8"
                />
                <span className="text-sm">: 1</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Superfat & Fragrance */}
        <Card className="border-t-4 border-t-emerald-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-serif text-emerald-900">4. Superfat & Fragrance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Superfat / Discount %</Label>
              <Input 
                type="number" 
                value={superfat} 
                onChange={(e) => setSuperfat(parseFloat(e.target.value))}
                className="w-20 h-8"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Fragrance Ratio (oz/lb)</Label>
              <Input 
                type="number" 
                value={fragranceRatio} 
                onChange={(e) => setFragranceRatio(parseFloat(e.target.value))}
                className="w-20 h-8"
              />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Middle Column: Oil Selection & List */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="border-t-4 border-t-emerald-600 shadow-sm h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-serif text-emerald-900">5. Recipe Oils</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={currentOilId} onValueChange={setCurrentOilId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an oil..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {soapCalcOilsData.sort((a,b) => a.name.localeCompare(b.name)).map((oil) => (
                    <SelectItem key={oil.id} value={oil.id.toString()}>
                      {oil.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addOil} size="icon" className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Oil</TableHead>
                    <TableHead className="w-[25%]">%</TableHead>
                    <TableHead className="w-[25%]">{weightUnit}</TableHead>
                    <TableHead className="w-[10%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOils.map((oil, index) => {
                    const oilData = getOilById(oil.oilId);
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-xs">{oilData?.name}</TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            value={oil.percentage} 
                            onChange={(e) => updateOilAmount(index, parseFloat(e.target.value), "percent")}
                            className="h-7 text-xs px-1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            value={oil.amount.toFixed(2)} 
                            onChange={(e) => updateOilAmount(index, parseFloat(e.target.value), "weight")}
                            className="h-7 text-xs px-1"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeOil(index)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {selectedOils.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                        Add oils to start building your recipe
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-between items-center text-sm font-medium px-2">
              <span>Totals:</span>
              <span className={Math.abs(selectedOils.reduce((s, o) => s + o.percentage, 0) - 100) > 0.1 ? "text-red-500" : "text-green-600"}>
                {selectedOils.reduce((s, o) => s + o.percentage, 0).toFixed(1)}%
              </span>
              <span>
                {selectedOils.reduce((s, o) => s + o.amount, 0).toFixed(2)} {weightUnit}
              </span>
            </div>

            <Button onClick={calculateRecipe} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white gap-2">
              <Calculator className="h-4 w-4" /> Calculate Recipe
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Qualities & Results */}
      <div className="lg:col-span-3 space-y-6">
        <Card className="border-t-4 border-t-emerald-600 shadow-sm bg-stone-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-serif text-emerald-900">Soap Qualities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {/* Quality Table */}
            <div className="grid grid-cols-3 gap-y-1 border-b pb-2 mb-2 font-medium text-xs text-muted-foreground">
              <span>Property</span>
              <span className="text-right">Range</span>
              <span className="text-right">Your Recipe</span>
            </div>
            
            {[
              { name: "Hardness", range: "29 - 54", val: results?.qualities.hardness },
              { name: "Cleansing", range: "12 - 22", val: results?.qualities.cleansing },
              { name: "Conditioning", range: "44 - 69", val: results?.qualities.conditioning },
              { name: "Bubbly", range: "14 - 46", val: results?.qualities.bubbly },
              { name: "Creamy", range: "16 - 48", val: results?.qualities.creamy },
              { name: "Iodine", range: "41 - 70", val: results?.qualities.iodine },
              { name: "INS", range: "136 - 165", val: results?.qualities.ins },
            ].map((q) => (
              <div key={q.name} className="grid grid-cols-3 gap-y-1 items-center">
                <span>{q.name}</span>
                <span className="text-right text-xs text-muted-foreground">{q.range}</span>
                <span className={`text-right font-bold ${!results ? 'text-gray-300' : ''}`}>
                  {results ? Math.round(q.val || 0) : "-"}
                </span>
              </div>
            ))}

            <Separator className="my-4" />
            
            <div className="grid grid-cols-2 gap-y-1 font-medium text-xs text-muted-foreground mb-2">
              <span>Fatty Acid</span>
              <span className="text-right">Value</span>
            </div>

            {[
              { name: "Lauric", val: results?.fattyAcids.lauric },
              { name: "Myristic", val: results?.fattyAcids.myristic },
              { name: "Palmitic", val: results?.fattyAcids.palmitic },
              { name: "Stearic", val: results?.fattyAcids.stearic },
              { name: "Ricinoleic", val: results?.fattyAcids.ricinoleic },
              { name: "Oleic", val: results?.fattyAcids.oleic },
              { name: "Linoleic", val: results?.fattyAcids.linoleic },
              { name: "Linolenic", val: results?.fattyAcids.linolenic },
            ].map((f) => (
              <div key={f.name} className="grid grid-cols-2 gap-y-1 items-center">
                <span>{f.name}</span>
                <span className={`text-right font-bold ${!results ? 'text-gray-300' : ''}`}>
                  {results ? Math.round(f.val || 0) : "-"}
                </span>
              </div>
            ))}

            <Separator className="my-4" />

            <div className="flex justify-between items-center">
              <span className="font-medium">Sat : Unsat Ratio</span>
              <span className={`font-bold ${!results ? 'text-gray-300' : ''}`}>
                {results ? `${Math.round(results.satRatio)} : ${Math.round(results.unsatRatio)}` : "- : -"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-emerald-600 shadow-sm bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-serif text-emerald-900">Recipe Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
             <div className="flex justify-between border-b border-emerald-200 pb-1">
               <span>Lye Amount:</span>
               <span className="font-bold">{results ? results.lyeAmount.toFixed(2) : "-"} {weightUnit}</span>
             </div>
             <div className="flex justify-between border-b border-emerald-200 pb-1">
               <span>Water Amount:</span>
               <span className="font-bold">{results ? results.waterAmount.toFixed(2) : "-"} {weightUnit}</span>
             </div>
             <div className="flex justify-between border-b border-emerald-200 pb-1">
               <span>Fragrance:</span>
               <span className="font-bold">{results ? results.fragranceAmount.toFixed(2) : "-"} {weightUnit === 'g' ? 'g' : 'oz'}</span>
             </div>
             <div className="flex justify-between pt-1">
               <span className="font-bold text-emerald-800">Total Batch:</span>
               <span className="font-bold text-emerald-800">{results ? results.totalBatchWeight.toFixed(2) : "-"} {weightUnit}</span>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SoapCalcReplica;
