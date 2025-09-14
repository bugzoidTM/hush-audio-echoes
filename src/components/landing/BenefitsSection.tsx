
import { Heart, Clock, Users, Mic } from "lucide-react";

const BenefitsSection = () => {
  return (
    <section className="container mx-auto px-4 py-16 bg-primary/5 dark:bg-primary/10" aria-labelledby="benefits-title">
      <h2 id="benefits-title" className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
        A revolução do áudio temporário
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Autêntico
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Expressão Real
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Voz sem filtros sociais
            </div>
          </div>
        </div>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              24h
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Temporário
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Liberdade que expira
            </div>
          </div>
        </div>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Social
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Conecte-se
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Comunidade vocal
            </div>
          </div>
        </div>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
            <Mic className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Criativo
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Filtros Únicos
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Voz transformada
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
