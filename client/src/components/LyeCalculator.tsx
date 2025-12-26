import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

// SAP values (NaOH) for common oils
const OILS_DB = [
  { name: "Almond Oil, Sweet", sap: 0.136 },
  { name: "Apricot Kernel Oil", sap: 0.135 },
  { name: "Avocado Oil", sap: 0.133 },
  { name: "Babassu Oil", sap: 0.175 },
  { name: "Beeswax", sap: 0.069 },
  { name: "Castor Oil", sap: 0.128 },
  { name: "Cocoa Butter", sap: 0.137 },
  { name: "Coconut Oil, 76 deg", sap: 0.190 },
  { name: "Grapeseed Oil", sap: 0.126 },
  { name: "Hemp Oil", sap: 0.135 },
  { name: "Jojoba Oil", sap: 0.069 },
  { name: "Lard", sap: 0.138 },
  { name: "Mango Butter", sap: 0.137 },
  { name: "Olive Oil", sap: 0.134 },
  { name: "Palm Oil", sap: 0.141 },
  { name: "Rice Bran Oil", sap: 0.128 },
  { name: "Shea Butter", sap: 0.128 },
  { name: "Sunflower Oil", sap: 0.134 },
  { name: "Tallow, Beef", sap: 0.140 },
];

interface SelectedOil {
  id: number;
  name: string;
  weight: number;
  sap: number;
}

export function LyeCalculator() {
  const [selectedOils, setSelectedOils] = useState<SelectedOil[]>([]);
  const [superfat, setSuperfat] = useState(5); // Default 5%
  const [waterRatio, setWaterRatio] = useState(38); // Default 38% of oils
  const [unit, setUnit] = useState("oz"); // oz or g

  const addOil = (oilName: string) => {
    const oil = OILS_DB.find(o => o.name === oilName);
    if (oil) {
      setSelectedOils([...selectedOils, { 
        id: Date.now(), 
        name: oil.name, 
        weight: 0, 
        sap: oil.sap 
      }]);
    }
  };

  const updateWeight = (id: number, weight: number) => {
    setSelectedOils(selectedOils.map(o => o.id === id ? { ...o, weight } : o));
  };

  const removeOil = (id: number) => {
    setSelectedOils(selectedOils.filter(o => o.id !== id));
  };

  // Calculations
  const totalOilWeight = selectedOils.reduce((sum, oil) => sum + oil.weight, 0);
  
  const totalLye = selectedOils.reduce((sum, oil) => {
    return sum + (oil.weight * oil.sap);
  }, 0);

  const lyeDiscount = totalLye * (superfat / 100);
  const finalLye = totalLye - lyeDiscount;
  
  const waterAmount = totalOilWeight * (waterRatio / 100);
  const totalBatchWeight = totalOilWeight + finalLye + waterAmount;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl font-serif">
              <Calculator className="w-6 h-6 mr-2 text-primary" />
              Recipe Formulator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oz">Ounces (oz)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Superfat (%)</Label>
                <Input 
                  type="number" 
                  value={superfat} 
                  onChange={(e) => setSuperfat(Number(e.target.value))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Water Ratio (%)</Label>
                <Input 
                  type="number" 
                  value={waterRatio} 
                  onChange={(e) => setWaterRatio(Number(e.target.value))} 
                />
              </div>
            </div>

            <Separator />

            {/* Oil Selection */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <Select onValueChange={addOil}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add an oil..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OILS_DB.map((oil, idx) => (
                      <SelectItem key={idx} value={oil.name}>{oil.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {selectedOils.map((oil) => (
                  <div key={oil.id} className="flex items-center gap-3 bg-background/50 p-2 rounded-md border border-border/50">
                    <span className="flex-grow text-sm font-medium">{oil.name}</span>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        className="w-20 h-8 text-right" 
                        placeholder="0"
                        value={oil.weight || ''}
                        onChange={(e) => updateWeight(oil.id, Number(e.target.value))}
                      />
                      <span className="text-xs text-muted-foreground w-6">{unit}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive/90"
                      onClick={() => removeOil(oil.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {selectedOils.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm italic border-2 border-dashed border-muted rounded-lg">
                    Select oils to begin formulating your recipe
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="border-none shadow-lg bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl font-serif text-primary">Recipe Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background/80 p-4 rounded-lg shadow-sm">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Total Oil Weight</Label>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {totalOilWeight.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
                </div>
              </div>
              <div className="bg-background/80 p-4 rounded-lg shadow-sm">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Total Batch Weight</Label>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {totalBatchWeight.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
                </div>
              </div>
            </div>

            <Separator className="bg-primary/20" />

            <div className="space-y-4">
              <h3 className="font-serif font-bold text-lg text-foreground">Lye & Liquids</h3>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-primary/20">
                    <TableHead className="text-primary font-bold">Ingredient</TableHead>
                    <TableHead className="text-right text-primary font-bold">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-primary/5 border-primary/10">
                    <TableCell className="font-medium">Water / Liquid</TableCell>
                    <TableCell className="text-right font-mono font-bold">{waterAmount.toFixed(2)} {unit}</TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-primary/5 border-primary/10 bg-primary/10">
                    <TableCell className="font-medium text-primary-foreground/90">Lye (NaOH)</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary-foreground/90">{finalLye.toFixed(2)} {unit}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-800">
              <p className="font-bold mb-1 flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2" />
                Safety Warning
              </p>
              Always run your recipe through multiple calculators before making a batch. Wear safety goggles and gloves when handling lye.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
