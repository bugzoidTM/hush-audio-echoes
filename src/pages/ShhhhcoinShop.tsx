import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useShhhhcoin } from '@/hooks/useShhhhcoin';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatShhhhcoins } from '@/utils/shhhhcoin';
import { 
  ShoppingBag, 
  Wallet, 
  Star, 
  Filter,
  Palette,
  TrendingUp,
  Award,
  Clock,
  Zap,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Crown,
  Gift
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ShhhhcoinShop = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {
    wallet,
    products,
    purchases,
    loading,
    error,
    purchaseProduct,
    refreshData
  } = useShhhhcoin();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Carregando loja...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Erro ao carregar loja</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={refreshData}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePurchase = async () => {
    if (!selectedProduct) return;
    
    setIsPurchasing(true);
    try {
      const success = await purchaseProduct(selectedProduct.id);
      if (success) {
        setShowPurchaseDialog(false);
        setSelectedProduct(null);
      }
    } catch (error) {
      console.error('Erro na compra:', error);
    } finally {
      setIsPurchasing(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'filters': return <Filter className="w-5 h-5" />;
      case 'themes': return <Palette className="w-5 h-5" />;
      case 'promotion': return <TrendingUp className="w-5 h-5" />;
      case 'features': return <Zap className="w-5 h-5" />;
      case 'badges': return <Award className="w-5 h-5" />;
      case 'bundles': return <Gift className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const getCategoryName = (category: string) => {
    const names = {
      filters: 'Filtros de Voz',
      themes: 'Temas',
      promotion: 'Promoção',
      features: 'Funcionalidades',
      badges: 'Badges',
      bundles: 'Pacotes'
    };
    return names[category as keyof typeof names] || category;
  };

  const getProductIcon = (product: any) => {
    switch (product.category) {
      case 'filters': return <Filter className="w-8 h-8" />;
      case 'themes': return <Palette className="w-8 h-8" />;
      case 'promotion': return <TrendingUp className="w-8 h-8" />;
      case 'features': return <Zap className="w-8 h-8" />;
      case 'badges': return <Crown className="w-8 h-8" />;
      case 'bundles': return <Gift className="w-8 h-8" />;
      default: return <Star className="w-8 h-8" />;
    }
  };

  const isPurchased = (productId: string) => {
    return purchases.some(purchase => 
      purchase.product_id === productId && 
      purchase.status === 'completed' &&
      (!purchase.expires_at || new Date(purchase.expires_at) > new Date())
    );
  };

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(product => product.category === selectedCategory);

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  const canAfford = (price: number) => (wallet?.balance || 0) >= price;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShoppingBag className="w-8 h-8" />
              Loja Shhhhcoin
            </h1>
            <p className="text-muted-foreground">Desbloqueie funcionalidades incríveis com seus shhhhcoins</p>
          </div>
          <div className="flex items-center gap-4">
            <Card className="px-4 py-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="font-bold">{formatShhhhcoins(wallet?.balance || 0)}</span>
              </div>
            </Card>
            <Button onClick={() => navigate('/shhhhcoin-wallet')} variant="outline">
              Minha Carteira
            </Button>
            <Button onClick={() => navigate('/shhhh')} variant="outline">
              Voltar ao Feed
            </Button>
          </div>
        </div>

        {/* Categorias */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Categorias</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="flex items-center gap-2"
              >
                {category !== 'all' && getCategoryIcon(category)}
                {category === 'all' ? 'Todos' : getCategoryName(category)}
              </Button>
            ))}
          </div>
        </div>

        {/* Produtos */}
        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhum produto disponível</h3>
              <p className="text-muted-foreground">
                {selectedCategory === 'all' 
                  ? 'Não há produtos disponíveis no momento' 
                  : `Não há produtos na categoria "${getCategoryName(selectedCategory)}"`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const purchased = isPurchased(product.id);
              const affordable = canAfford(product.price);
              
              return (
                <Card key={product.id} className={`relative ${purchased ? 'border-green-500 bg-green-50' : ''}`}>
                  {purchased && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge className="bg-green-500">
                        <Check className="w-3 h-3 mr-1" />
                        Adquirido
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        product.category === 'bundles' ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' :
                        product.category === 'badges' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {getProductIcon(product)}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {getCategoryName(product.category)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground text-sm">{product.description}</p>
                    
                    {/* Informações de duração */}
                    {product.duration_days && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{product.duration_days} dias</span>
                      </div>
                    )}
                    
                    {product.is_permanent && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Sparkles className="w-4 h-4" />
                        <span>Permanente</span>
                      </div>
                    )}

                    {/* Preço e botão de compra */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-2xl font-bold text-primary">
                        {formatShhhhcoins(product.price)}
                      </div>
                      
                      {purchased ? (
                        <Button disabled className="bg-green-500">
                          <Check className="w-4 h-4 mr-2" />
                          Adquirido
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowPurchaseDialog(true);
                          }}
                          disabled={!affordable}
                          variant={affordable ? "default" : "outline"}
                        >
                          {affordable ? 'Comprar' : 'Saldo Insuficiente'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Suas compras */}
        {purchases.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Suas Compras</CardTitle>
              <CardDescription>Funcionalidades que você adquiriu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {purchases.slice(0, 5).map((purchase) => {
                  const product = products.find(p => p.id === purchase.product_id);
                  if (!product) return null;

                  const isActive = !purchase.expires_at || new Date(purchase.expires_at) > new Date();
                  
                  return (
                    <div key={purchase.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">
                          {getProductIcon(product)}
                        </div>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Comprado em {format(new Date(purchase.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            {purchase.expires_at && (
                              <span> • Expira em {format(new Date(purchase.expires_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isActive ? 'Ativo' : 'Expirado'}
                        </Badge>
                        <span className="font-medium text-muted-foreground">
                          {formatShhhhcoins(purchase.amount_paid)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {purchases.length > 5 && (
                  <Button variant="outline" className="w-full">
                    Ver todas as compras ({purchases.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog de confirmação de compra */}
        <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Compra</DialogTitle>
              <DialogDescription>
                Você está prestes a comprar uma funcionalidade premium
              </DialogDescription>
            </DialogHeader>
            
            {selectedProduct && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    {getProductIcon(selectedProduct)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{selectedProduct.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Preço:</span>
                    <span className="font-bold">{formatShhhhcoins(selectedProduct.price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Seu saldo atual:</span>
                    <span>{formatShhhhcoins(wallet?.balance || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Saldo após compra:</span>
                    <span className="font-bold">
                      {formatShhhhcoins((wallet?.balance || 0) - selectedProduct.price)}
                    </span>
                  </div>
                </div>

                {selectedProduct.duration_days && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">Duração: {selectedProduct.duration_days} dias</span>
                    </div>
                  </div>
                )}

                {selectedProduct.is_permanent && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700">
                      <Sparkles className="w-4 h-4" />
                      <span className="font-medium">Esta funcionalidade é permanente</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handlePurchase}
                    disabled={!canAfford(selectedProduct.price) || isPurchasing}
                    className="flex-1"
                  >
                    {isPurchasing ? 'Processando...' : 'Confirmar Compra'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPurchaseDialog(false)}
                    disabled={isPurchasing}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ShhhhcoinShop;
