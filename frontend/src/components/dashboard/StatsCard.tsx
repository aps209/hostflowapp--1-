import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useRestaurant } from "../RestaurantContext";

export default function StatsCard({ title, value, icon: Icon, useAccentColor = false }) {
  const { colorPrimario, colorAccento } = useRestaurant();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div 
              className="p-3 rounded-xl shadow-lg"
              style={{
                background: useAccentColor 
                  ? `linear-gradient(135deg, ${colorAccento}, ${colorPrimario})` 
                  : `linear-gradient(135deg, ${colorPrimario}, ${colorAccento})`
              }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}