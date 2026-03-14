"use client";

import { useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";

import { useBankStore } from "@/lib/bank-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ProfileForm() {
  const { user, updateUser, resetData } = useBankStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [formData, setFormData] = useState({
    email: user.email ?? "",
    phone: user.phone ?? "",
    address: user.address ?? ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccessMsg("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMsg("");
    try {
      await updateUser(formData);
      setSuccessMsg("Profile updated successfully.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm("Are you sure you want to reset all account data? This cannot be undone.")) {
      setIsResetting(true);
      setSuccessMsg("");
      try {
        await resetData();
        setSuccessMsg("Account data has been reset to defaults.");
      } catch (err) {
        console.error(err);
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Update your personal details here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <Input name="email" value={formData.email} onChange={handleChange} placeholder="Email" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone Number</label>
            <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Address</label>
            <Textarea name="address" value={formData.address} onChange={handleChange} placeholder="Address" rows={3} />
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
          {successMsg && <p className="mt-2 text-sm text-green-600 font-medium">{successMsg}</p>}
        </CardContent>
      </Card>

      <Card className="glass-card border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="text-red-700">Danger Zone</CardTitle>
          <CardDescription className="text-red-600/80">Revert your account balances and transaction history back to their initial state.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleReset} variant="outline" className="text-red-600 hover:bg-red-100/50 hover:text-red-700 border-red-200" disabled={isResetting}>
            {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Reset All Account Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
