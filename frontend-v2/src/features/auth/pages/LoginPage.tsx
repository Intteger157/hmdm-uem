import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { MOCK_AUTH } from '@/shared/api/mocks/auth'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { fetchCurrentUser, loginWithJwt } from '@/features/auth/api/auth-api'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const jwt = await loginWithJwt(values.login, values.password)
      useAuthStore.setState({ jwt })
      const user = await fetchCurrentUser()
      setAuth(jwt, user)
      void navigate({ to: '/dashboard' })
    } catch (err) {
      const isUnauthorized =
        (err instanceof Error && 'status' in err && err.status === 401) ||
        (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 400))
      if (isUnauthorized) {
        form.setError('root', { message: t('login.error') })
      } else {
        form.setError('root', { message: t('login.error') })
      }
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('login.title')}</CardTitle>
        <CardDescription>
          {isMockApiEnabled()
            ? t('login.mockHint', { login: MOCK_AUTH.login, password: MOCK_AUTH.password })
            : t('app.title')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('login.username')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('login.password')}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {form.formState.errors.root.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('login.loading') : t('login.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
