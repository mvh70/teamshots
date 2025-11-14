import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SelfieApproval from '@/components/Upload/SelfieApproval';

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
      'selfieApproval.title': 'Review your selfie',
      'selfieApproval.guidelines.title': 'Photo quality guidelines',
      'selfieApproval.guidelines.clearFace': 'Clear, well-lit face',
      'selfieApproval.guidelines.lookingAtCamera': 'Looking at camera',
      'selfieApproval.guidelines.goodResolution': 'Good resolution',
      'selfieApproval.guidelines.cleanBackground': 'Clean background',
      'selfieApproval.buttons.approveContinue': 'Approve & Save',
      'selfieApproval.buttons.retakePhoto': 'Retake Photo',
      'selfieApproval.buttons.cancel': 'Cancel',
      'selfieApproval.buttons.processing': 'Processing...',
    };
    return translations[key] || key;
  },
}));

describe('SelfieApproval Component', () => {
  const mockProps = {
    uploadedPhotoKey: 'test-photo-key',
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onRetake: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders approval screen with correct elements', () => {
    render(<SelfieApproval {...mockProps} />);

    expect(screen.getByText('Review your selfie')).toBeInTheDocument();
    expect(screen.getByText('Photo quality guidelines')).toBeInTheDocument();
    expect(screen.getByText('Clear, well-lit face')).toBeInTheDocument();
    expect(screen.getByText('Looking at camera')).toBeInTheDocument();
    expect(screen.getByText('Good resolution')).toBeInTheDocument();
    expect(screen.getByText('Clean background')).toBeInTheDocument();
  });

  test('displays uploaded selfie image', () => {
    render(<SelfieApproval {...mockProps} />);

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', expect.stringContaining('test-photo-key'));
  });

  test('calls onApprove when approve button is clicked', async () => {
    render(<SelfieApproval {...mockProps} />);

    const approveButton = screen.getByText('Approve & Save');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(mockProps.onApprove).toHaveBeenCalledTimes(1);
    });
  });

  test('calls onRetake when retake button is clicked', () => {
    render(<SelfieApproval {...mockProps} />);

    const retakeButton = screen.getByText('Retake Photo');
    fireEvent.click(retakeButton);

    expect(mockProps.onRetake).toHaveBeenCalledTimes(1);
  });

  test('calls onReject and onCancel when cancel button is clicked', () => {
    render(<SelfieApproval {...mockProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockProps.onReject).toHaveBeenCalledTimes(1);
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test('shows processing state when approve button is clicked', async () => {
    render(<SelfieApproval {...mockProps} />);

    const approveButton = screen.getByText('Approve & Save');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  test('disables buttons during processing', async () => {
    render(<SelfieApproval {...mockProps} />);

    const approveButton = screen.getByText('Approve & Save');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(approveButton).toBeDisabled();
    });
  });

  test('renders quality guidelines with checkmarks', () => {
    render(<SelfieApproval {...mockProps} />);

    const guidelines = screen.getByText('Photo quality guidelines');
    expect(guidelines).toBeInTheDocument();

    // Check for guideline items
    expect(screen.getByText('Clear, well-lit face')).toBeInTheDocument();
    expect(screen.getByText('Looking at camera')).toBeInTheDocument();
    expect(screen.getByText('Good resolution')).toBeInTheDocument();
    expect(screen.getByText('Clean background')).toBeInTheDocument();
  });

  test('handles button interactions correctly', () => {
    render(<SelfieApproval {...mockProps} />);

    // Test all button interactions
    fireEvent.click(screen.getByText('Approve & Save'));
    expect(mockProps.onApprove).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Retake Photo'));
    expect(mockProps.onRetake).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockProps.onReject).toHaveBeenCalledTimes(1);
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
