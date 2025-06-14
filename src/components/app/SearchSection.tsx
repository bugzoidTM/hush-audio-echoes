
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const SearchSection = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="p-6 space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Pesquisar áudios temporários..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="text-center text-muted-foreground">
        <p>Digite algo para pesquisar áudios temporários</p>
      </div>
    </div>
  );
};

export default SearchSection;
