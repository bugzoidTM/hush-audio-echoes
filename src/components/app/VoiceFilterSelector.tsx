
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { voiceFilters, VoiceFilter } from '@/utils/voiceFilters';

interface VoiceFilterSelectorProps {
  value: VoiceFilter;
  onChange: (value: VoiceFilter) => void;
  disabled?: boolean;
}

const VoiceFilterSelector = ({ value, onChange, disabled = false }: VoiceFilterSelectorProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Filtro de Voz</label>
      <Select 
        value={value} 
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {voiceFilters.map((filter) => (
            <SelectItem key={filter.value} value={filter.value}>
              {filter.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default VoiceFilterSelector;
