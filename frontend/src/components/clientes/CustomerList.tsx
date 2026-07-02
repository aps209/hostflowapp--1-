import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Mail, Phone, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LoyaltyBadge from "./LoyaltyBadge";

const getTextColor = (hexcolor) => {
  if (!hexcolor) return '#1e293b';
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3) {
    hexcolor = hexcolor[0] + hexcolor[0] + hexcolor[1] + hexcolor[1] + hexcolor[2] + hexcolor[2];
  }
  if (hexcolor.length !== 6) return '#1e293b';
  var r = parseInt(hexcolor.substr(0, 2), 16);
  var g = parseInt(hexcolor.substr(2, 2), 16);
  var b = parseInt(hexcolor.substr(4, 2), 16);
  var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 160) ? '#1e293b' : '#ffffff';
};

function CustomerCard({ customer, onEdit, onDelete, allTags }) {
  const customerTags = (customer.tags || [])
    .map(tagName => allTags.find(tag => tag.nombre === tagName))
    .filter(Boolean);

  return (
    <Card 
      className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900 hover:shadow-2xl transition-shadow cursor-pointer"
      onClick={() => onEdit(customer)}
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{customer.nombre}</h3>
              <LoyaltyBadge totalVisitas={customer.total_visitas || 0} />
            </div>
            {customerTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {customerTags.map((tag) => (
                  <Badge 
                    key={tag.id} 
                    style={{ backgroundColor: tag.color, color: getTextColor(tag.color) }} 
                    className="text-xs border-none"
                  >
                    {tag.nombre}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(customer.id);
            }}
            className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-4">
          {customer.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span className="truncate">{customer.email}</span>
            </div>
          )}
          {customer.telefono && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>{customer.telefono}</span>
            </div>
          )}
          {(customer.total_visitas || 0) > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>{customer.total_visitas || 0} Visitas</span>
            </div>
          )}
        </div>

        {(customer.alergias || customer.preferencias) && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs">
            {customer.alergias && (
              <p className="text-amber-900 dark:text-amber-200"><strong>Alergias:</strong> {customer.alergias}</p>
            )}
            {customer.preferencias && (
              <p className="text-amber-900 dark:text-amber-200 mt-1"><strong>Preferencias:</strong> {customer.preferencias}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function CustomerList({ customers, isLoading, onEdit, onDelete, allTags }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-6 dark:bg-slate-900">
            <Skeleton className="h-32 w-full dark:bg-slate-800" />
          </Card>
        ))}
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <Card className="p-12 text-center border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400 text-lg">No se encontraron clientes</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {customers.map((customer) => (
        <CustomerCard 
          key={customer.id} 
          customer={customer} 
          onEdit={onEdit} 
          onDelete={onDelete}
          allTags={allTags}
        />
      ))}
    </div>
  );
}