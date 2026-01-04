"use client"
import { LoadingSpinner } from '@/components/loading-spinner';
import { ReCaptchaProvider } from '@/hooks/recaptcha-provider';
import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';
import React, { useEffect } from 'react';

const AuthLayout = ({children}: {children: React.ReactNode}) => {
    const { user, loading, refreshUser } = useAuth()

    useEffect(() => {
        if (user) {
            return redirect('/dashboard')
        }
    }, [user])

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (user) {
        return (
            <>
                {children}
            </>
        )
    }

    return (
        <ReCaptchaProvider>
            {children}
        </ReCaptchaProvider>
    );
};

export default AuthLayout;