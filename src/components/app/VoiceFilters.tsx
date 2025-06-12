
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VoiceFilter {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const voiceFilters: VoiceFilter[] = [
  { id: 'normal', name: 'Normal', description: 'Voz natural', icon: '🎤' },
  { id: 'robot', name: 'Robô', description: 'Voz robótica', icon: '🤖' },
  { id: 'helium', name: 'Hélio', description: 'Voz aguda', icon: '🎈' },
  { id: 'deep', name: 'Grave', description: 'Voz mais grave', icon: '🗣️' },
  { id: 'echo', name: 'Eco', description: 'Com efeito de eco', icon: '🔊' },
  { id: 'whisper', name: 'Sussurro', description: 'Voz baixa', icon: '🤫' },
  { id: 'alien', name: 'Alien', description: 'Voz alienígena', icon: '👽' },
  { id: 'chipmunk', name: 'Esquilo', description: 'Voz de esquilo', icon: '🐿️' },
];

interface VoiceFiltersProps {
  selectedFilter: string;
  onFilterChange: (filterId: string) => void;
}

const VoiceFilters = ({ selectedFilter, onFilterChange }: VoiceFiltersProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filtros de Voz</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {voiceFilters.map((filter) => (
            <Button
              key={filter.id}
              variant={selectedFilter === filter.id ? "default" : "outline"}
              onClick={() => onFilterChange(filter.id)}
              className="flex items-center space-x-2 h-auto p-3"
            >
              <span className="text-lg">{filter.icon}</span>
              <div className="text-left">
                <div className="font-medium text-sm">{filter.name}</div>
                <div className="text-xs opacity-70">{filter.description}</div>
              </div>
            </Button>
          ))}
        </div>
        
        {selectedFilter !== 'normal' && (
          <div className="mt-3 p-2 bg-muted rounded">
            <Badge variant="secondary">
              Filtro ativo: {voiceFilters.find(f => f.id === selectedFilter)?.name}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VoiceFilters;
