// auth.js
import {getSupabase} from './config.js';

export const checkAuth = async () => {
    const supabase = getSupabase();
    if (!supabase) return null;

    const {data: {session}, error} = await supabase.auth.getSession();
    if (error) {
        console.error("Auth check error:", error);
        return null;
    }
    return session?.user || null;
};

export const logout = async () => {
    const supabase = getSupabase();
    if (supabase) {
        await supabase.auth.signOut();
    }
    window.location.href = 'index.html';
};

export const loginUsuario = async (email, password) => {
    const supabase = getSupabase();
    const {data, error} = await supabase.auth.signInWithPassword({
        email,
        password
    });
    return {data, error};
};

export const registrarUsuario = async (email, password, firstName, lastName) => {
    const supabase = getSupabase();
    const {data, error} = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                first_name: firstName,
                last_name: lastName
            }
        }
    });
    return {data, error};
};