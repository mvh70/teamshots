import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SelfieUploadFlow from '@/components/Upload/SelfieUploadFlow';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({ src, alt, ...props }: Record<string, unknown>) {
    return React.createElement('div', {
      ...props,
      'data-src': src as string,
      'data-alt': alt as string,
      'data-testid': 'mock-image',
      style: { backgroundImage: `url(${src as string})` }
    });
  }
}));

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'selfies.upload.title': 'Upload a New Selfie',
      'selfies.upload.description': 'Take a photo with your camera or upload an existing photo to get started.',
      'selfies.upload.successTitle': 'Selfie Approved!',
      'selfies.upload.successDescription': 'Your selfie has been saved successfully.',
    };
    return translations[key] || key;
  },
}));

// Mock PhotoUpload component
jest.mock('@/components/Upload/PhotoUpload', () => {
  return function MockPhotoUpload({ onUploaded }: { onUploaded: (result: { key: string; url?: string }) => void }) {
    return (
      <div data-testid="photo-upload">
        <button
          data-testid="mock-upload-button"
          onClick={() => onUploaded({ key: 'test-photo-key', url: 'test-url' })}
        >
          Mock Upload
        </button>
      </div>
    );
  };
});

// Mock SelfieApproval component
jest.mock('@/components/Upload/SelfieApproval', () => {
  return function MockSelfieApproval({ onApprove, onReject, onRetake, onCancel }: {
    onApprove: () => void
    onReject: () => void
    onRetake: () => void
    onCancel: () => void
  }) {
    return (
      <div data-testid="mock-approval">
        <button data-testid="mock-approve" onClick={onApprove}>Approve</button>
        <button data-testid="mock-reject" onClick={onReject}>Reject</button>
        <button data-testid="mock-retake" onClick={onRetake}>Retake</button>
        <button data-testid="mock-cancel" onClick={onCancel}>Cancel</button>
      </div>
    );
  };
});

describe('SelfieUploadFlow Component', () => {
  const mockProps = {
    onSelfieApproved: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders upload interface initially', () => {
    render(<SelfieUploadFlow {...mockProps} />);

    expect(screen.getByText('Upload a New Selfie')).toBeInTheDocument();
    expect(screen.getByText('Take a photo with your camera or upload an existing photo to get started.')).toBeInTheDocument();
    expect(screen.getByTestId('photo-upload')).toBeInTheDocument();
  });

  test('shows approval screen after photo upload', async () => {
    render(<SelfieUploadFlow {...mockProps} />);

    const uploadButton = screen.getByTestId('mock-upload-button');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByTestId('mock-approval')).toBeInTheDocument();
    });
  });

  test('calls onSelfieApproved when selfie is approved', async () => {
    render(<SelfieUploadFlow {...mockProps} />);

    // Upload photo
    fireEvent.click(screen.getByTestId('mock-upload-button'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-approval')).toBeInTheDocument();
    });

    // Approve selfie
    fireEvent.click(screen.getByTestId('mock-approve'));

    await waitFor(() => {
      expect(mockProps.onSelfieApproved).toHaveBeenCalledWith('test-photo-key');
    });
  });

  test('shows success message after approval', async () => {
    render(<SelfieUploadFlow {...mockProps} />);

    // Upload and approve
    fireEvent.click(screen.getByTestId('mock-upload-button'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-approval')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mock-approve'));

    await waitFor(() => {
      expect(screen.getByText('Selfie Approved!')).toBeInTheDocument();
      expect(screen.getByText('Your selfie has been saved successfully.')).toBeInTheDocument();
    });
  });

  test('handles retake flow', async () => {
    render(<SelfieUploadFlow {...mockProps} />);

    // Upload photo
    fireEvent.click(screen.getByTestId('mock-upload-button'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-approval')).toBeInTheDocument();
    });

    // Retake
    fireEvent.click(screen.getByTestId('mock-retake'));

    await waitFor(() => {
      expect(screen.getByTestId('photo-upload')).toBeInTheDocument();
    });
  });

  test('handles rejection flow', async () => {
    render(<SelfieUploadFlow {...mockProps} />);

    // Upload photo
    fireEvent.click(screen.getByTestId('mock-upload-button'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-approval')).toBeInTheDocument();
    });

    // Reject
    fireEvent.click(screen.getByTestId('mock-reject'));

    await waitFor(() => {
      expect(screen.getByTestId('photo-upload')).toBeInTheDocument();
    });
  });

  test('handles cancel from approval', async () => {
    render(<SelfieUploadFlow {...mockProps} />);

    // Upload photo
    fireEvent.click(screen.getByTestId('mock-upload-button'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-approval')).toBeInTheDocument();
    });

    // Cancel
    fireEvent.click(screen.getByTestId('mock-cancel'));

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test('handles cancel from upload interface', () => {
    render(<SelfieUploadFlow {...mockProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test('resets state after successful approval', async () => {
    render(<SelfieUploadFlow {...mockProps} />);

    // Complete flow
    fireEvent.click(screen.getByTestId('mock-upload-button'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-approval')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mock-approve'));

    // Wait for success message and then completion
    await waitFor(() => {
      expect(screen.getByText('Selfie Approved!')).toBeInTheDocument();
    });

    // After completion, should be ready for new upload
    await waitFor(() => {
      expect(screen.getByTestId('photo-upload')).toBeInTheDocument();
    });
  });
});
