import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// UCC inspired color palette for ImmunoClinic.
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF00AFC6);
  static const Color primaryLight = Color(0xFF45D2DF);
  static const Color primaryDark = Color(0xFF007F93);

  static const Color accent = Color(0xFF79C143);
  static const Color accentLight = Color(0xFFA7DA64);
  static const Color lime = Color(0xFFD7E91E);
  static const Color limeSoft = Color(0xFFF2F8B9);
  static const Color brandGray = Color(0xFF5B5B61);

  static const Color success = Color(0xFF5FAE36);
  static const Color successLight = Color(0xFFEAF6E4);
  static const Color warning = Color(0xFFE6A700);
  static const Color warningLight = Color(0xFFFFF6D6);
  static const Color error = Color(0xFFC94242);
  static const Color errorLight = Color(0xFFFFECEC);
  static const Color info = Color(0xFF008FA3);
  static const Color infoLight = Color(0xFFE2F7FA);

  static const Color background = Color(0xFFF6FAFA);
  static const Color surface = Colors.white;
  static const Color surfaceVariant = Color(0xFFEFF7F7);
  static const Color textPrimary = Color(0xFF172629);
  static const Color textSecondary = Color(0xFF647478);
  static const Color textHint = Color(0xFF9AA8AB);
  static const Color divider = Color(0xFFDDEAEA);
  static const Color border = Color(0xFFC7DADA);

  static const Color darkBackground = Color(0xFF071416);
  static const Color darkSurface = Color(0xFF0E2023);
  static const Color darkSurfaceVariant = Color(0xFF142D31);
  static const Color darkTextPrimary = Color(0xFFEAF7F7);
  static const Color darkTextSecondary = Color(0xFFA8BFC2);
  static const Color darkDivider = Color(0xFF244247);
  static const Color darkBorder = Color(0xFF2D4F55);

  static const Color statusPending = Color(0xFF829196);
  static const Color statusInReview = Color(0xFFE6A700);
  static const Color statusApproved = Color(0xFF5FAE36);
  static const Color statusDenied = Color(0xFFC94242);

  static const LinearGradient brandGradient = LinearGradient(
    colors: [primaryDark, primary, accent],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient softGradient = LinearGradient(
    colors: [Color(0xFFEAFBFC), Color(0xFFF5FBEE)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient darkSoftGradient = LinearGradient(
    colors: [Color(0xFF061A1D), Color(0xFF10200E)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

/// App theme configuration.
class AppTheme {
  AppTheme._();

  static final PageTransitionsTheme pageTransitionsTheme = PageTransitionsTheme(
    builders: {
      TargetPlatform.android: const FadeUpwardsPageTransitionsBuilder(),
      // Resolve the Cupertino builder through the stable theme API across SDKs.
      TargetPlatform.iOS:
          const PageTransitionsTheme().builders[TargetPlatform.iOS]!,
      TargetPlatform.macOS:
          const PageTransitionsTheme().builders[TargetPlatform.macOS]!,
      TargetPlatform.windows: const FadeUpwardsPageTransitionsBuilder(),
      TargetPlatform.linux: const FadeUpwardsPageTransitionsBuilder(),
    },
  );

  static ThemeData get lightTheme => _buildTheme(Brightness.light);

  static ThemeData get darkTheme => _buildTheme(Brightness.dark);

  static ThemeData _buildTheme(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final baseTextTheme = GoogleFonts.interTextTheme();
    final textPrimary = isDark
        ? AppColors.darkTextPrimary
        : AppColors.textPrimary;
    final textSecondary = isDark
        ? AppColors.darkTextSecondary
        : AppColors.textSecondary;
    final background = isDark ? AppColors.darkBackground : AppColors.background;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final surfaceVariant = isDark
        ? AppColors.darkSurfaceVariant
        : AppColors.surfaceVariant;
    final border = isDark ? AppColors.darkBorder : AppColors.border;
    final divider = isDark ? AppColors.darkDivider : AppColors.divider;
    final primary = isDark ? AppColors.primaryLight : AppColors.primary;
    final primaryButton = isDark ? AppColors.primaryDark : AppColors.primary;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: brightness,
        primary: primary,
        secondary: AppColors.accent,
        surface: surface,
        error: AppColors.error,
      ),
      scaffoldBackgroundColor: background,
      textTheme: baseTextTheme.apply(
        bodyColor: textPrimary,
        displayColor: textPrimary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: textPrimary,
        ),
        iconTheme: IconThemeData(color: primary),
        actionsIconTheme: IconThemeData(color: primary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryButton,
          foregroundColor: Colors.white,
          disabledBackgroundColor: border,
          disabledForegroundColor: textSecondary,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primaryButton,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          side: BorderSide(color: primary),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primary,
          textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: border, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        hintStyle: GoogleFonts.inter(
          color: textSecondary.withValues(alpha: 0.7),
        ),
        labelStyle: GoogleFonts.inter(color: textSecondary),
        prefixIconColor: primary,
        suffixIconColor: primary,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: divider),
        ),
        color: surface,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: surfaceVariant,
        selectedColor: isDark
            ? AppColors.darkSurfaceVariant
            : AppColors.infoLight,
        checkmarkColor: primary,
        labelStyle: GoogleFonts.inter(
          color: textPrimary,
          fontWeight: FontWeight.w600,
        ),
        side: BorderSide(color: divider),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      badgeTheme: const BadgeThemeData(
        backgroundColor: AppColors.lime,
        textColor: AppColors.textPrimary,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
        linearTrackColor: AppColors.infoLight,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: isDark
            ? AppColors.darkSurfaceVariant
            : AppColors.textPrimary,
        contentTextStyle: GoogleFonts.inter(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: surface,
        elevation: 6,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: GoogleFonts.inter(color: textPrimary),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: primary,
        textColor: textPrimary,
      ),
      dividerTheme: DividerThemeData(color: divider, thickness: 1),
      pageTransitionsTheme: pageTransitionsTheme,
    );
  }
}
