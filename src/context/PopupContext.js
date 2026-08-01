'use client';
import { createContext, useContext, useState } from 'react';
import Popup from '@/components/Popup';

const PopupContext = createContext(null);

export function PopupProvider({ children }) {
  const [popup, setPopup] = useState(null); // { title, message, type, resolve, isConfirm }

  // Triggers an alert popup and returns a Promise resolving when 'OK' is clicked
  const showAlert = (title, message, type = 'info') => {
    return new Promise((resolve) => {
      setPopup({
        title,
        message,
        type,
        resolve,
        isConfirm: false
      });
    });
  };

  // Triggers a confirmation popup and returns a Promise resolving to true/false
  const showConfirm = (title, message, type = 'warning') => {
    return new Promise((resolve) => {
      setPopup({
        title,
        message,
        type,
        resolve,
        isConfirm: true
      });
    });
  };

  const handleConfirm = () => {
    if (popup) {
      popup.resolve(true);
      setPopup(null);
    }
  };

  const handleCancel = () => {
    if (popup) {
      popup.resolve(false);
      setPopup(null);
    }
  };

  return (
    <PopupContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {popup && (
        <Popup
          title={popup.title}
          message={popup.message}
          type={popup.type}
          isConfirm={popup.isConfirm}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  return context;
}
