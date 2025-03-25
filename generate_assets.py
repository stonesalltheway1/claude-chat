#!/usr/bin/env python3
"""
InsightWave Asset Generator

This script generates all necessary brand assets for the InsightWave application:
- Vector logo (SVG)
- UI icons (SVG)
- App icons in various sizes (PNG)
- Favicon package (ICO, PNG)

Features:
- Automatic dependency installation
- High-quality vector and raster assets
- Complete PWA icon set
- Comprehensive favicon package for cross-platform support

Author: Advanced Frontend Engineer
Date: 2025-03-25
"""

import os
import sys
import subprocess
import shutil
import json
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Tuple, Union, Optional
import math

# Define project paths
PROJECT_ROOT = Path(os.path.abspath(os.path.dirname(__file__)))
ASSETS_DIR = PROJECT_ROOT / "assets"
ICONS_DIR = ASSETS_DIR / "icons"
IMAGES_DIR = ASSETS_DIR / "images"

# Create directories if they don't exist
for directory in [ASSETS_DIR, ICONS_DIR, IMAGES_DIR]:
    directory.mkdir(exist_ok=True, parents=True)

# Define brand colors
class BrandColors:
    PRIMARY = "#4A6FFF"  # Bright blue
    SECONDARY = "#6E56CF"  # Purple
    ACCENT = "#00C2FF"  # Cyan
    DARK = "#1A1D2B"  # Dark blue/gray
    LIGHT = "#F5F9FF"  # Light blue/white
    SUCCESS = "#2DD4BF"  # Teal
    WARNING = "#F59E0B"  # Amber
    ERROR = "#EF4444"  # Red
    GRADIENT_START = "#4A6FFF"
    GRADIENT_END = "#00C2FF"
    
    @classmethod
    def get_gradient_stops(cls, count: int) -> List[str]:
        """Generate gradient color stops between start and end colors."""
        def hex_to_rgb(hex_color: str) -> Tuple[float, float, float]:
            hex_color = hex_color.lstrip('#')
            return tuple(int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4))
        
        def rgb_to_hex(rgb: Tuple[float, float, float]) -> str:
            return '#{:02x}{:02x}{:02x}'.format(
                int(rgb[0] * 255), int(rgb[1] * 255), int(rgb[2] * 255))
        
        start_rgb = hex_to_rgb(cls.GRADIENT_START)
        end_rgb = hex_to_rgb(cls.GRADIENT_END)
        
        gradient = []
        for i in range(count):
            t = i / (count - 1) if count > 1 else 0
            rgb = tuple(start + (end - start) * t for start, end in zip(start_rgb, end_rgb))
            gradient.append(rgb_to_hex(rgb))
        
        return gradient

# Check and install dependencies
def install_dependencies():
    """Install required Python packages if they're not already installed."""
    required_packages = [
        "pillow",
        "cairosvg",
        "svgwrite",
        "numpy",
        "click",
        "rich",
    ]
    
    # Check if we're in a virtual environment
    in_venv = sys.prefix != sys.base_prefix
    pip_command = [sys.executable, "-m", "pip", "install"]
    
    try:
        from rich.console import Console
        from rich.progress import Progress, SpinnerColumn, TextColumn
        fancy_output = True
    except ImportError:
        fancy_output = False
        print("Installing dependencies...")
        
    if fancy_output:
        console = Console()
        console.print("[bold blue]InsightWave Asset Generator[/bold blue]")
        console.print("Checking dependencies...", style="dim")
    
    # Check installed packages
    try:
        import pkg_resources
        installed_packages = {pkg.key for pkg in pkg_resources.working_set}
        missing = [pkg for pkg in required_packages if pkg.lower() not in installed_packages]
    except ImportError:
        missing = required_packages
    
    if missing:
        if fancy_output:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                transient=True
            ) as progress:
                task = progress.add_task("[cyan]Installing dependencies...", total=None)
                subprocess.check_call(pip_command + missing, 
                                    stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL)
                progress.update(task, completed=True)
            console.print("✓ Dependencies installed", style="green")
        else:
            print(f"Installing: {', '.join(missing)}")
            subprocess.check_call(pip_command + missing)
            print("Dependencies installed.")
    else:
        if fancy_output:
            console.print("✓ All dependencies already installed", style="green")
        else:
            print("All dependencies already installed.")

# Install dependencies
install_dependencies()

# Now import the packages we need
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import svgwrite
import cairosvg
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()

# Create a design system
class DesignSystem:
    """Design system for InsightWave brand assets"""
    
    @staticmethod
    def create_wave_path(width: int, height: int, amplitude: float = 0.1, 
                        frequency: float = 1.0, phase: float = 0.0) -> List[Tuple[float, float]]:
        """Generate wave path for SVG"""
        points = []
        for x in range(width + 1):
            y = height / 2 + (height * amplitude) * math.sin(
                (x / width * 2 * math.pi * frequency) + phase)
            points.append((x, y))
        return points
    
    @staticmethod
    def create_gradient_filter(dwg: svgwrite.Drawing, id_name: str, 
                             start_color: str, end_color: str, 
                             direction: str = "horizontal") -> None:
        """Create a linear gradient filter for SVG"""
        gradient = dwg.linearGradient(id=id_name)
        
        if direction == "horizontal":
            gradient.update({"x1": 0, "y1": 0.5, "x2": 1, "y2": 0.5})
        elif direction == "vertical":
            gradient.update({"x1": 0.5, "y1": 0, "x2": 0.5, "y2": 1})
        elif direction == "diagonal":
            gradient.update({"x1": 0, "y1": 0, "x2": 1, "y2": 1})
        
        gradient.add_stop_color(offset=0, color=start_color)
        gradient.add_stop_color(offset=1, color=end_color)
        
        dwg.defs.add(gradient)
    
    @staticmethod
    def create_drop_shadow_filter(dwg: svgwrite.Drawing, id_name: str, 
                                stdDeviation: float = 3) -> None:
        """Create a drop shadow filter for SVG"""
        filter_effect = dwg.defs.add(dwg.filter(id=id_name))
        filter_effect.feGaussianBlur(in_="SourceAlpha", stdDeviation=stdDeviation)
        filter_effect.feOffset(dx=1, dy=1)
        filter_effect.feComposite(in2="SourceAlpha", operator="arithmetic", k2=-1, k3=1)
        filter_effect.feColorMatrix(values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0")
        filter_effect.feBlend(in_="SourceGraphic", mode="normal")
    
    @staticmethod
    def create_glow_filter(dwg: svgwrite.Drawing, id_name: str, 
                         color: str = BrandColors.ACCENT, strength: float = 3) -> None:
        """Create a glow filter for SVG"""
        filter_effect = dwg.defs.add(dwg.filter(id=id_name))
        filter_effect.feColorMatrix(type="matrix", 
                                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0")
        filter_effect.feGaussianBlur(stdDeviation=strength)
        
        # Fixed: Creating component transfer correctly
        comp_transfer = filter_effect.feComponentTransfer()
        comp_transfer.feFuncA(type_="linear", slope=0.7)
        
        filter_effect.feBlend(in_="SourceGraphic", mode="screen")
        
# Asset generator class
class AssetGenerator:
    """Generates all assets for the InsightWave application"""
    
    def __init__(self):
        self.design = DesignSystem()
        self.temp_dir = tempfile.mkdtemp()
    
    def __del__(self):
        # Clean up temp directory
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass
    
    def generate_logo_svg(self, output_path: Path) -> None:
        """Generate the InsightWave logo in SVG format"""
        width, height = 240, 80
        # Use standard SVG profile (not 'tiny')
        dwg = svgwrite.Drawing(str(output_path), size=(f"{width}px", f"{height}px"))
        
        # Create filters and gradients
        self.design.create_gradient_filter(dwg, "logoGradient", 
                                         BrandColors.GRADIENT_START, 
                                         BrandColors.GRADIENT_END)
        self.design.create_glow_filter(dwg, "logoGlow")
        
        # Create the wave paths
        wave1 = self.design.create_wave_path(width, height // 2, 
                                           amplitude=0.35, frequency=1.5, phase=0)
        wave2 = self.design.create_wave_path(width, height // 2, 
                                           amplitude=0.25, frequency=1.8, phase=math.pi/2)
        
        # Draw the waves
        wave1_path = dwg.path(d="M" + " L".join([f"{x},{y+10}" for x, y in wave1]), 
                            stroke_width=6, stroke="url(#logoGradient)", 
                            fill="none", stroke_linecap="round",
                            filter="url(#logoGlow)")
        
        wave2_path = dwg.path(d="M" + " L".join([f"{x},{y+25}" for x, y in wave2]), 
                            stroke_width=4, stroke="url(#logoGradient)", 
                            fill="none", stroke_linecap="round",
                            opacity=0.8)
        
        # Draw the lightbulb/insight icon
        bulb_group = dwg.g()
        
        # Bulb base
        bulb_base = dwg.circle(center=(45, 30), r=18, 
                             fill="url(#logoGradient)")
        
        # Light rays (simplified)
        for i in range(8):
            angle = i * math.pi / 4
            ray_x = 45 + 25 * math.cos(angle)
            ray_y = 30 + 25 * math.sin(angle)
            ray = dwg.line(start=(45, 30), end=(ray_x, ray_y), 
                         stroke="url(#logoGradient)", stroke_width=2, 
                         opacity=0.6, stroke_linecap="round")
            bulb_group.add(ray)
        
        # Add the text
        text_group = dwg.g(font_family="Arial, sans-serif", font_weight="bold")
        insight_text = dwg.text("Insight", insert=(75, 35), font_size=24, fill=BrandColors.PRIMARY)
        wave_text = dwg.text("Wave", insert=(75, 60), font_size=24, fill=BrandColors.ACCENT)
        
        # Assemble the logo
        dwg.add(wave1_path)
        dwg.add(wave2_path)
        bulb_group.add(bulb_base)
        dwg.add(bulb_group)
        text_group.add(insight_text)
        text_group.add(wave_text)
        dwg.add(text_group)
        
        # Save the SVG
        dwg.save()
        console.print(f"✓ Created logo: [cyan]{output_path}[/cyan]")
    
    def generate_ui_icons(self) -> None:
        """Generate all UI icons in SVG format"""
        icon_specs = {
            "send": self._create_send_icon,
            "settings": self._create_settings_icon,
            "close": self._create_close_icon,
            "menu": self._create_menu_icon,
            "user": self._create_user_icon,
            "assistant": self._create_assistant_icon,
            "attachment": self._create_attachment_icon,
            "copy": self._create_copy_icon,
            "download": self._create_download_icon,
            "edit": self._create_edit_icon,
            "delete": self._create_delete_icon,
            "theme": self._create_theme_icon,
            "notification": self._create_notification_icon,
        }
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            overall_task = progress.add_task("[cyan]Generating UI icons...", total=len(icon_specs))
            
            for icon_name, create_func in icon_specs.items():
                output_path = ICONS_DIR / f"{icon_name}.svg"
                create_func(output_path)
                progress.update(overall_task, advance=1)
                
        console.print(f"✓ Created [bold]{len(icon_specs)}[/bold] UI icons in [cyan]{ICONS_DIR}[/cyan]")
    
    # All icon creation methods - only showing one as example since they all follow the same pattern
    def _create_send_icon(self, output_path: Path) -> None:
        """Create the send message icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "sendGradient", 
                                         BrandColors.PRIMARY, BrandColors.ACCENT)
        
        # Create paper plane shape
        points = [
            (2, 2),      # Top left
            (22, 12),    # Right point
            (2, 22),     # Bottom left
            (8, 12)      # Middle indentation
        ]
        
        # Draw the shape
        plane = dwg.polygon(points=points, fill="url(#sendGradient)")
        dwg.add(plane)
        
        # Save the icon
        dwg.save()
    
    # [Remaining icon creation methods would go here...]
    
    def _create_settings_icon(self, output_path: Path) -> None:
        """Create the settings icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "settingsGradient", 
                                         BrandColors.PRIMARY, BrandColors.SECONDARY)
        
        # Create gear shape
        center = size / 2
        outer_radius = size * 0.4
        inner_radius = size * 0.25
        teeth = 8
        
        gear_path = []
        
        for i in range(teeth * 2):
            angle = i * math.pi / teeth
            radius = outer_radius if i % 2 == 0 else inner_radius
            x = center + radius * math.cos(angle)
            y = center + radius * math.sin(angle)
            gear_path.append((x, y))
        
        # Create center circle
        center_circle = dwg.circle(center=(center, center), r=size * 0.12, 
                                 fill="white")
        
        # Draw the shape
        gear = dwg.polygon(points=gear_path, fill="url(#settingsGradient)")
        dwg.add(gear)
        dwg.add(center_circle)
        
        # Save the icon
        dwg.save()
    
    def _create_close_icon(self, output_path: Path) -> None:
        """Create a close (X) icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "closeGradient", 
                                         BrandColors.ERROR, BrandColors.SECONDARY)
        
        # Create X shape
        line1 = dwg.line(start=(4, 4), end=(20, 20), stroke="url(#closeGradient)", 
                       stroke_width=3, stroke_linecap="round")
        line2 = dwg.line(start=(4, 20), end=(20, 4), stroke="url(#closeGradient)", 
                       stroke_width=3, stroke_linecap="round")
        
        dwg.add(line1)
        dwg.add(line2)
        
        # Save the icon
        dwg.save()
    
    def _create_menu_icon(self, output_path: Path) -> None:
        """Create a hamburger menu icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "menuGradient", 
                                         BrandColors.PRIMARY, BrandColors.ACCENT)
        
        # Create three horizontal lines
        line1 = dwg.line(start=(4, 6), end=(20, 6), stroke="url(#menuGradient)", 
                       stroke_width=2, stroke_linecap="round")
        line2 = dwg.line(start=(4, 12), end=(20, 12), stroke="url(#menuGradient)", 
                       stroke_width=2, stroke_linecap="round")
        line3 = dwg.line(start=(4, 18), end=(20, 18), stroke="url(#menuGradient)", 
                       stroke_width=2, stroke_linecap="round")
        
        dwg.add(line1)
        dwg.add(line2)
        dwg.add(line3)
        
        # Save the icon
        dwg.save()
    
    def _create_user_icon(self, output_path: Path) -> None:
        """Create a user/person icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "userGradient", 
                                         BrandColors.PRIMARY, BrandColors.SECONDARY)
        
        # Create head and body
        head = dwg.circle(center=(12, 8), r=5, fill="url(#userGradient)")
        body = dwg.path(d="M4,21 A8,5 0 0 1 20,21", fill="none", 
                      stroke="url(#userGradient)", stroke_width=2)
        
        dwg.add(head)
        dwg.add(body)
        
        # Save the icon
        dwg.save()
    
    def _create_assistant_icon(self, output_path: Path) -> None:
        """Create an AI assistant icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "assistantGradient", 
                                         BrandColors.ACCENT, BrandColors.PRIMARY)
        
        # Create robot face
        face = dwg.rect(insert=(4, 4), size=(16, 16), rx=4, ry=4, 
                      fill="url(#assistantGradient)")
        
        # Create eyes
        eye1 = dwg.circle(center=(9, 10), r=1.5, fill="white")
        eye2 = dwg.circle(center=(15, 10), r=1.5, fill="white")
        
        # Create mouth
        mouth = dwg.path(d="M8,16 L16,16", stroke="white", stroke_width=1.5, 
                       stroke_linecap="round")
        
        # Add antenna
        antenna = dwg.path(d="M12,4 L12,1 M9,2 L15,2", stroke="url(#assistantGradient)", 
                         stroke_width=1.5, stroke_linecap="round")
        
        dwg.add(face)
        dwg.add(eye1)
        dwg.add(eye2)
        dwg.add(mouth)
        dwg.add(antenna)
        
        # Save the icon
        dwg.save()
    
    def _create_attachment_icon(self, output_path: Path) -> None:
        """Create an attachment/paperclip icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "attachGradient", 
                                         BrandColors.PRIMARY, BrandColors.SECONDARY)
        
        # Create paperclip shape
        clip = dwg.path(
            d="M21.44,11.05l-9.19,9.19a6,6,0,0,1-8.49-8.49l9.19-9.19a4,4,0,0,1,5.66,5.66l-9.2,9.19a2,2,0,0,1-2.83-2.83l8.49-8.48",
            fill="none", stroke="url(#attachGradient)", stroke_width=2, 
            stroke_linecap="round", stroke_linejoin="round")
        
        dwg.add(clip)
        
        # Save the icon
        dwg.save()
    
    def _create_copy_icon(self, output_path: Path) -> None:
        """Create a copy to clipboard icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "copyGradient", 
                                         BrandColors.PRIMARY, BrandColors.ACCENT)
        
        # Create clipboard shape
        board = dwg.rect(insert=(7, 4), size=(12, 16), rx=1, ry=1, 
                       fill="none", stroke="url(#copyGradient)", stroke_width=1.5)
        
        paper = dwg.rect(insert=(4, 7), size=(12, 16), rx=1, ry=1, 
                       fill="white", stroke="url(#copyGradient)", stroke_width=1.5)
        
        # Create lines on the paper
        line1 = dwg.line(start=(7, 12), end=(13, 12), stroke="url(#copyGradient)", 
                       stroke_width=1, stroke_linecap="round")
        line2 = dwg.line(start=(7, 15), end=(13, 15), stroke="url(#copyGradient)", 
                       stroke_width=1, stroke_linecap="round")
        line3 = dwg.line(start=(7, 18), end=(11, 18), stroke="url(#copyGradient)", 
                       stroke_width=1, stroke_linecap="round")
        
        dwg.add(board)
        dwg.add(paper)
        dwg.add(line1)
        dwg.add(line2)
        dwg.add(line3)
        
        # Save the icon
        dwg.save()
    
    def _create_download_icon(self, output_path: Path) -> None:
        """Create a download icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "downloadGradient", 
                                         BrandColors.PRIMARY, BrandColors.SUCCESS)
        
        # Create download arrow
        arrow = dwg.path(
            d="M12,4 L12,16 M7,12 L12,17 L17,12",
            fill="none", stroke="url(#downloadGradient)", stroke_width=2, 
            stroke_linecap="round")
        
        # Create line at bottom
        line = dwg.path(d="M4,20 L20,20", stroke="url(#downloadGradient)", 
                       stroke_width=2, stroke_linecap="round")
        
        dwg.add(arrow)
        dwg.add(line)
        
        # Save the icon
        dwg.save()
    
    def _create_edit_icon(self, output_path: Path) -> None:
        """Create an edit/pencil icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "editGradient", 
                                         BrandColors.PRIMARY, BrandColors.WARNING)
        
        # Create pencil shape
        pencil = dwg.path(
            d="M17,3 L21,7 L7,21 L3,21 L3,17 L17,3 Z",
            fill="none", stroke="url(#editGradient)", stroke_width=1.5, 
            stroke_linecap="round", stroke_linejoin="round")
        
        # Create line for pencil tip details
        line = dwg.path(d="M15,5 L19,9", stroke="url(#editGradient)", 
                       stroke_width=1, stroke_linecap="round")
        
        dwg.add(pencil)
        dwg.add(line)
        
        # Save the icon
        dwg.save()
    
    def _create_delete_icon(self, output_path: Path) -> None:
        """Create a delete/trash icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "deleteGradient", 
                                         BrandColors.ERROR, BrandColors.SECONDARY)
        
        # Create trash can
        can = dwg.path(
            d="M5,6 L19,6 L18,21 L6,21 L5,6 Z",
            fill="none", stroke="url(#deleteGradient)", stroke_width=1.5, 
            stroke_linecap="round", stroke_linejoin="round")
        
        # Create lid
        lid = dwg.path(d="M3,6 L21,6 M9,3 L15,3 L15,6", stroke="url(#deleteGradient)", 
                     stroke_width=1.5, stroke_linecap="round", stroke_linejoin="round")
        
        # Create lines on the can
        line1 = dwg.line(start=(10, 10), end=(10, 17), stroke="url(#deleteGradient)", 
                        stroke_width=1.5, stroke_linecap="round")
        line2 = dwg.line(start=(14, 10), end=(14, 17), stroke="url(#deleteGradient)", 
                        stroke_width=1.5, stroke_linecap="round")
        
        dwg.add(can)
        dwg.add(lid)
        dwg.add(line1)
        dwg.add(line2)
        
        # Save the icon
        dwg.save()
    
    def _create_theme_icon(self, output_path: Path) -> None:
        """Create a theme/palette icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "themeGradient", 
                                         BrandColors.PRIMARY, BrandColors.SECONDARY)
        
        # Create palette shape
        palette = dwg.path(
            d="M12,2 A10,10 0 1 0 17.5,21 A4,4 0 0 1 17.5,13 A4,4 0 0 1 21.5,13 C21.5,10 20,2 12,2 Z",
            fill="none", stroke="url(#themeGradient)", stroke_width=1.5, 
            stroke_linecap="round", stroke_linejoin="round")
        
        # Create color dots
        colors = [BrandColors.PRIMARY, BrandColors.SECONDARY, 
                  BrandColors.ACCENT, BrandColors.SUCCESS]
        positions = [(8, 8), (12, 10), (8, 14), (16, 8)]
        
        for i, (color, pos) in enumerate(zip(colors, positions)):
            dot = dwg.circle(center=pos, r=1.5, fill=color)
            dwg.add(dot)
        
        dwg.add(palette)
        
        # Save the icon
        dwg.save()
    
    def _create_notification_icon(self, output_path: Path) -> None:
        """Create a notification/bell icon"""
        size = 24
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create gradient
        self.design.create_gradient_filter(dwg, "notifyGradient", 
                                         BrandColors.WARNING, BrandColors.ACCENT)
        
        # Create bell shape
        bell = dwg.path(
            d="M18,8 A6,6 0 0 0 6,8 C6,18 3,20 3,20 L21,20 C21,20 18,18 18,8 Z",
            fill="none", stroke="url(#notifyGradient)", stroke_width=1.5, 
            stroke_linecap="round", stroke_linejoin="round")
        
        # Create ringer at bottom
        ringer = dwg.path(d="M12,20 L12,22", stroke="url(#notifyGradient)", 
                         stroke_width=1.5, stroke_linecap="round")
        
        # Create dot at top
        dot = dwg.circle(center=(12, 3), r=1, fill="url(#notifyGradient)")
        
        dwg.add(bell)
        dwg.add(ringer)
        dwg.add(dot)
        
        # Save the icon
        dwg.save()
    
    def generate_app_icons(self) -> None:
        """Generate app icons for various platforms and sizes"""
        # First, create a high-quality base SVG
        base_svg_path = Path(self.temp_dir) / "app-icon-base.svg"
        self._create_app_icon_svg(base_svg_path)
        
        # Define sizes needed for various platforms
        icon_sizes = {
            # PWA and manifest icons
            "app-icon-16.png": 16,
            "app-icon-32.png": 32,
            "app-icon-48.png": 48,
            "app-icon-72.png": 72,
            "app-icon-96.png": 96,
            "app-icon-144.png": 144,
            "app-icon-192.png": 192,
            "app-icon-256.png": 256,
            "app-icon-384.png": 384,
            "app-icon-512.png": 512,
            # Apple touch icons
            "apple-touch-icon.png": 180,
            "apple-touch-icon-precomposed.png": 180,
            # Microsoft tile image
            "ms-tile-image.png": 144,
        }
        
        # Generate favicon.ico with multiple sizes
        favicon_sizes = [16, 32, 48]
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            overall_task = progress.add_task(
                "[cyan]Generating app icons...", total=len(icon_sizes) + 1)  # +1 for favicon
            
            # Generate PNG icons
            for filename, size in icon_sizes.items():
                output_path = IMAGES_DIR / filename
                
                # Convert SVG to PNG at specified size
                self._convert_svg_to_png(base_svg_path, output_path, size)
                
                progress.update(overall_task, advance=1)
            
            # Generate favicon.ico (multi-size)
            favicon_path = IMAGES_DIR / "favicon.ico"
            self._create_favicon(base_svg_path, favicon_path, favicon_sizes)
            progress.update(overall_task, advance=1)
            
            # Create a monochrome SVG for Safari pinned tab (special case)
            safari_svg_path = IMAGES_DIR / "safari-pinned-tab.svg"
            self._create_monochrome_svg_icon(base_svg_path, safari_svg_path)
        
        console.print(f"✓ Created [bold]{len(icon_sizes) + 2}[/bold] app icons in [cyan]{IMAGES_DIR}[/cyan]")
        
    def _create_app_icon_svg(self, output_path: Path) -> None:
        """Create the app icon as SVG"""
        size = 512  # Base size
        dwg = svgwrite.Drawing(str(output_path), size=(f"{size}px", f"{size}px"))
        
        # Create filters and gradients
        self.design.create_gradient_filter(dwg, "iconGradient", 
                                         BrandColors.GRADIENT_START, 
                                         BrandColors.GRADIENT_END, 
                                         direction="diagonal")
        self.design.create_glow_filter(dwg, "iconGlow", 
                                     color=BrandColors.ACCENT, strength=4)
        
        # Background
        background = dwg.rect(insert=(0, 0), size=(size, size), rx=size/4, ry=size/4,
                            fill=BrandColors.DARK)
        
        # Center coordinates
        cx, cy = size/2, size/2
        
        # Create wave paths
        wave_height = size * 0.5
        wave_width = size * 0.8
        wave1_start_x = (size - wave_width) / 2
        wave1_start_y = cy + size * 0.05
        
        wave1_points = self.design.create_wave_path(
            int(wave_width), int(wave_height), amplitude=0.3, frequency=1.5)
        
        wave1_path = dwg.path(
            d="M" + " L".join([f"{x+wave1_start_x},{y+wave1_start_y}" for x, y in wave1_points]), 
            stroke_width=size/25, stroke="url(#iconGradient)", 
            fill="none", stroke_linecap="round",
            filter="url(#iconGlow)")
        
        # Create lightbulb/insight icon
        bulb_cx = cx
        bulb_cy = cy - size * 0.15
        bulb_r = size * 0.12
        
        bulb = dwg.circle(center=(bulb_cx, bulb_cy), r=bulb_r, 
                        fill="url(#iconGradient)",
                        filter="url(#iconGlow)")
        
        # Light rays
        for i in range(8):
            angle = i * math.pi / 4
            inner_r = bulb_r * 1.1
            outer_r = bulb_r * 1.6
            
            start_x = bulb_cx + inner_r * math.cos(angle)
            start_y = bulb_cy + inner_r * math.sin(angle)
            end_x = bulb_cx + outer_r * math.cos(angle)
            end_y = bulb_cy + outer_r * math.sin(angle)
            
            ray = dwg.line(start=(start_x, start_y), end=(end_x, end_y), 
                         stroke="url(#iconGradient)", stroke_width=size/60, 
                         opacity=0.8, stroke_linecap="round")
            dwg.add(ray)
        
        # Assemble the icon
        dwg.add(background)
        dwg.add(wave1_path)
        dwg.add(bulb)
        
        # Save the SVG
        dwg.save()
    
    def _create_monochrome_svg_icon(self, input_svg: Path, output_path: Path) -> None:
        """Create a monochrome (single color) version of the SVG icon"""
        # Read the input SVG
        with open(input_svg, 'r') as file:
            svg_content = file.read()
        
        # Create a simple monochrome version by replacing colors with black
        monochrome_svg = svg_content.replace(BrandColors.DARK, '#000000')
        
        # Replace fill and stroke color references
        import re
        monochrome_svg = re.sub(r'fill="url\(#[^"]+\)"', 'fill="#000000"', monochrome_svg)
        monochrome_svg = re.sub(r'stroke="url\(#[^"]+\)"', 'stroke="#000000"', monochrome_svg)
        
        # Remove filter attributes
        monochrome_svg = re.sub(r'filter="[^"]+"', '', monochrome_svg)
        
        # Remove gradient and filter definitions
        monochrome_svg = re.sub(r'<linearGradient[^>]*>.*?</linearGradient>', '', 
                               monochrome_svg, flags=re.DOTALL)
        monochrome_svg = re.sub(r'<filter[^>]*>.*?</filter>', '', 
                               monochrome_svg, flags=re.DOTALL)
        
        # Write the monochrome SVG
        with open(output_path, 'w') as file:
            file.write(monochrome_svg)
    
    def _convert_svg_to_png(self, svg_path: Path, output_path: Path, size: int) -> None:
        """Convert SVG to PNG at specified size"""
        output_dir = output_path.parent
        output_dir.mkdir(exist_ok=True, parents=True)
        
        # Use cairosvg for high-quality rendering
        cairosvg.svg2png(url=str(svg_path), write_to=str(output_path), 
                         output_width=size, output_height=size)
    
    def _create_favicon(self, svg_path: Path, output_path: Path, sizes: List[int]) -> None:
        """Create a multi-size favicon.ico file"""
        # Generate PNG images at each size
        png_files = []
        
        for size in sizes:
            temp_png = Path(self.temp_dir) / f"favicon-{size}.png"
            self._convert_svg_to_png(svg_path, temp_png, size)
            png_files.append(temp_png)
        
        # Create an ICO file with all sizes
        images = [Image.open(str(png_file)) for png_file in png_files]
        
        # Use the first image as base and save as ICO with all images
        images[0].save(
            str(output_path),
            format='ICO', 
            sizes=[(img.width, img.height) for img in images]
        )
    
    def update_manifest_json(self) -> None:
        """Update the manifest.json file with correct icon references"""
        manifest_path = PROJECT_ROOT / "manifest.json"
        
        # Define icons for the manifest
        icons = [
            {"src": "assets/images/app-icon-48.png", "sizes": "48x48", "type": "image/png"},
            {"src": "assets/images/app-icon-72.png", "sizes": "72x72", "type": "image/png"},
            {"src": "assets/images/app-icon-96.png", "sizes": "96x96", "type": "image/png"},
            {"src": "assets/images/app-icon-144.png", "sizes": "144x144", "type": "image/png"},
            {"src": "assets/images/app-icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "assets/images/app-icon-256.png", "sizes": "256x256", "type": "image/png"},
            {"src": "assets/images/app-icon-384.png", "sizes": "384x384", "type": "image/png"},
            {"src": "assets/images/app-icon-512.png", "sizes": "512x512", "type": "image/png"}
        ]
        
        # Create or update manifest.json
        if manifest_path.exists():
            try:
                with open(manifest_path, 'r') as file:
                    manifest = json.load(file)
            except:
                manifest = {}
        else:
            manifest = {}
        
        # Update manifest with standard fields if they don't exist
        if "name" not in manifest:
            manifest["name"] = "InsightWave"
        
        if "short_name" not in manifest:
            manifest["short_name"] = "InsightWave"
        
        if "description" not in manifest:
            manifest["description"] = "Conversations that elevate your thinking"
        
        if "theme_color" not in manifest:
            manifest["theme_color"] = BrandColors.PRIMARY
        
        if "background_color" not in manifest:
            manifest["background_color"] = BrandColors.DARK
        
        if "display" not in manifest:
            manifest["display"] = "standalone"
        
        if "start_url" not in manifest:
            manifest["start_url"] = "/"
        
        # Update icons
        manifest["icons"] = icons
        
        # Write updated manifest
        with open(manifest_path, 'w') as file:
            json.dump(manifest, file, indent=2)
        
        console.print(f"✓ Updated [cyan]{manifest_path}[/cyan] with icon references")

def main():
    console.print("[bold blue]InsightWave Asset Generator[/bold blue]")
    console.print("Generating brand assets for your application...\n")
    
    try:
        # Create asset generator
        generator = AssetGenerator()
        
        # Generate logo
        generator.generate_logo_svg(ICONS_DIR / "logo.svg")
        
        # Generate UI icons
        generator.generate_ui_icons()
        
        # Generate app icons
        generator.generate_app_icons()
        
        # Update manifest.json
        generator.update_manifest_json()
        
        console.print("\n[bold green]✓ Asset generation complete![/bold green]")
        console.print(f"\nAssets have been generated in:")
        console.print(f"  - [cyan]{ICONS_DIR}[/cyan] (SVG icons)")
        console.print(f"  - [cyan]{IMAGES_DIR}[/cyan] (App icons and favicon)")
        
    except Exception as e:
        console.print(f"\n[bold red]Error:[/bold red] {str(e)}", style="red")
        import traceback
        console.print(traceback.format_exc(), style="dim")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())