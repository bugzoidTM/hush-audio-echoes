import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { authErrorMessage } from '@/features/auth/authMessages';
import { TurnstileWidget } from '@/features/auth/TurnstileWidget';
import { turnstileEnabled } from '@/features/auth/turnstile';
import { DOCUMENT_VERSIONS, recordLegalAcceptance } from '@/features/auth/legalAcceptance';
import { trackAcquisition } from '@/features/analytics/services/acquisition';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Quem clicou em "Criar conta grátis" chegava na aba Entrar e tinha de
  // descobrir sozinho que precisava trocar de aba. Custa pouco tecnicamente e
  // caro em conversão, justo no passo mais frágil do funil.
  const [searchParams, setSearchParams] = useSearchParams();
  const modo = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const trocarModo = (proximo: string) => {
    setSearchParams(proximo === 'signup' ? { mode: 'signup' } : {}, { replace: true });
  };
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Só conta como "abriu o cadastro" quando a aba de cadastro está à frente.
  // Disparar em toda visita a /auth misturaria quem só queria entrar, e a
  // conversão signup_view → signup_completed sairia artificialmente baixa.
  useEffect(() => {
    if (modo === 'signup') trackAcquisition('signup_view');
  }, [modo]);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/app/echoes');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (turnstileEnabled && !captchaToken) {
      toast({
        title: 'Confirme que você não é um robô',
        description: 'A verificação de segurança ainda não terminou. Aguarde um instante e tente de novo.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, password, captchaToken);

    if (error) {
      toast({
        title: "Não foi possível entrar",
        description: authErrorMessage(error),
        variant: "destructive",
      });
      setIsLoading(false);
    } else {
      toast({
        title: "Login realizado com sucesso!",
        description: "Redirecionando...",
      });
      // O redirecionamento é feito automaticamente no signIn
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const username = formData.get('username') as string;

    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Sem chave configurada o widget não existe e o token é nulo: o cadastro
    // segue como hoje. Com a chave, o GoTrue é quem recusa sem token.
    if (turnstileEnabled && !captchaToken) {
      toast({
        title: 'Confirme que você não é um robô',
        description: 'A verificação de segurança ainda não terminou. Aguarde um instante e tente de novo.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, username, captchaToken);

    if (error) {
      toast({
        title: "Não foi possível criar a conta",
        description: authErrorMessage(error),
        variant: "destructive",
      });
    } else {
      // A conta já nasce ativa: não há confirmação por e-mail nesta instalação.
      toast({
        title: "Conta criada!",
        description: "Você já está entrando no shhhh.",
      });
      trackAcquisition('signup_completed');

      // Registro do aceite, com as versões dos documentos. Falhar aqui não
      // desfaz o cadastro — a pessoa já tem conta —, mas fica no console para
      // não sumir em silêncio.
      const { data: sessao } = await supabase.auth.getSession();
      if (sessao.session?.access_token) {
        void recordLegalAcceptance(sessao.session.access_token)
          .catch((erro) => console.error('aceite dos documentos não registrado', erro));
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl gradient-text">shhhh</CardTitle>
          <CardDescription>
            Ouça o que ninguém conta — ou conte do seu jeito.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={modo} onValueChange={trocarModo} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email">Email</label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password">Senha</label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Sua senha"
                    required
                  />
                </div>
                {/* O captcha vale para entrar também, não só para criar
                    conta: o GoTrue protege os dois caminhos com a mesma
                    variável, e sem o widget aqui ninguém consegue entrar. */}
                <TurnstileWidget onToken={setCaptchaToken} />
                <Button 
                  type="submit" 
                  className="w-full gradient-bg"
                  disabled={isLoading}
                >
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="username">Como você quer ser chamado</label>
                  <Input
                    id="username"
                    name="username"
                    placeholder="Compositor"
                    maxLength={60}
                    required
                  />
                  {/* Este nome não é a identidade pública por si só: ele vira a
                      sugestão da sua Voice no onboarding. A conta continua
                      separada da Voice — é isso que sustenta o anonimato. */}
                  <p className="text-xs text-muted-foreground">
                    Vira a sugestão da sua Voice (o @ público). Você pode mudar depois, e sempre pode publicar anonimamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="email">Email</label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password">Senha</label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Sua senha"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirmPassword">Confirmar senha</label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirme sua senha"
                    required
                  />
                </div>
                {/* Idade e aceite explícitos: o shhhh reúne desabafos sobre
                    sexualidade, relacionamentos e sofrimento emocional. Deixar
                    isso implícito seria ambíguo justamente onde não pode ser. */}
                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    name="aceite"
                    required
                    className="mt-0.5 size-4 shrink-0 rounded border-input"
                  />
                  <span>
                    Declaro que tenho <strong>18 anos ou mais</strong> e aceito os{' '}
                    <Link to="/termos" target="_blank" className="font-semibold text-primary hover:underline">Termos de Uso</Link>,{' '}
                    a <Link to="/privacidade" target="_blank" className="font-semibold text-primary hover:underline">Política de Privacidade</Link>{' '}
                    e as <Link to="/diretrizes" target="_blank" className="font-semibold text-primary hover:underline">Diretrizes da Comunidade</Link>.
                  </span>
                </label>
                <TurnstileWidget onToken={setCaptchaToken} />
                <Button 
                  type="submit" 
                  className="w-full gradient-bg"
                  disabled={isLoading}
                >
                  {isLoading ? "Cadastrando..." : "Cadastrar"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
