import React, { useEffect, useContext, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const CallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const isProcessing = useRef(false);
  const [loadingMsg, setLoadingMsg] = useState('Authenticating with Spotify...');

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      navigate('/login');
      return;
    }

    if (isProcessing.current) return;
    isProcessing.current = true;

    const exchangeCode = async () => {
      try {
        const response = await axios.post('http://127.0.0.1:5001/auth/callback', { code });
        const { access_token, refresh_token } = response.data;
        
        if (access_token) {
          login({ access_token, refresh_token });
          navigate('/dashboard', { replace: true });
        } else {
          console.error('No access token received');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error exchanging code for token:', error);
        setLoadingMsg('Authentication failed. Redirecting...');
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    exchangeCode();
  }, [searchParams, navigate, login]);

  return (
    <div className="flex items-center justify-center min-h-screen text-white bg-black">
      <h2 className="text-2xl">{loadingMsg}</h2>
    </div>
  );
};

export default CallbackPage;
