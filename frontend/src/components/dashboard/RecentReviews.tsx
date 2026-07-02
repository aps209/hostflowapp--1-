
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

export default function RecentReviews({ reviews }) {
  return (
    <Card className="border-0 shadow-xl shadow-slate-900/5 bg-white dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700">
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          Últimas Reviews
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {reviews.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-4">No hay reviews aún</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0 pb-4 last:pb-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < review.calificacion
                          ? "text-amber-500 fill-amber-500"
                          : "text-slate-300 dark:text-slate-600"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{review.cliente_nombre}</span>
              </div>
              {review.comentario && (
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{review.comentario}</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
