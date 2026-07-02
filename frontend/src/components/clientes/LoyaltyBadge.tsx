import React from "react";
import { Badge } from "@/components/ui/badge";
import { Crown, Award, Medal, Star } from "lucide-react";

export const getLoyaltyTier = (totalVisitas) => {
  if (totalVisitas >= 25) return "platino";
  if (totalVisitas >= 15) return "oro";
  if (totalVisitas >= 3) return "plata";
  return "bronce";
};

export const loyaltyConfig = {
  bronce: {
    name: "Bronce",
    color: "#CD7F32",
    bgColor: "bg-[#CD7F32]/10",
    textColor: "text-[#CD7F32]",
    borderColor: "border-[#CD7F32]/20",
    icon: Medal,
  },
  plata: {
    name: "Plata",
    color: "#C0C0C0",
    bgColor: "bg-slate-100",
    textColor: "text-slate-600",
    borderColor: "border-slate-200",
    icon: Award,
  },
  oro: {
    name: "Oro",
    color: "#FFD700",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
    borderColor: "border-yellow-200",
    icon: Crown,
  },
  platino: {
    name: "Platino",
    color: "#5DADE2",
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
    icon: Star,
  },
};

export default function LoyaltyBadge({ totalVisitas = 0, className = "" }) {
  const tier = getLoyaltyTier(totalVisitas);
  const config = loyaltyConfig[tier];
  const Icon = config.icon;

  return (
    <Badge 
      className={`${config.bgColor} ${config.textColor} border ${config.borderColor} font-semibold text-xs ${className}`}
    >
      <Icon className="w-3 h-3 mr-1" />
      {config.name}
    </Badge>
  );
}