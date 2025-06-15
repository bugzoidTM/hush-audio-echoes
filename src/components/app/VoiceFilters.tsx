
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { voiceFilters, VoiceFilter } from '@/utils/voiceFilters';

interface VoiceFiltersProps {
  selectedFilter: string;
  onFilterChange: (filterId: string) => void;
}

const VoiceFilters = ({ selectedFilter, onFilterChange }: VoiceFiltersProps) => {
  const getFilterIcon = (filter: VoiceFilter) => {
    switch (filter) {
      case 'normal': return '🎤';
      case 'robot': return '🤖';
      case 'helium': return '🎈';
      case 'deep': return '🗣️';
      case 'echo': return '🔊';
      default: return '🎤';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filtros de Voz</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {voiceFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={selectedFilter === filter.value ? "default" : "outline"}
              onClick={() => {
                console.log('🎛️ [VoiceFilters] Filtro selecionado:', filter.value);
                onFilterChange(filter.value);
              }}
              className="flex items-center space-x-2 h-auto p-3"
            >
              <span className="text-lg">{getFilterIcon(filter.value)}</span>
              <div className="text-left">
                <div className="font-medium text-sm">{filter.label}</div>
              </div>
            </Button>
          ))}
        </div>
        
        {selectedFilter !== 'normal' && (
          <div className="mt-3 p-2 bg-muted rounded">
            <Badge variant="secondary">
              Filtro ativo: {voiceFilters.find(f => f.value === selectedFilter)?.label}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VoiceFilters;
