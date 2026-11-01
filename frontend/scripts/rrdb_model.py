# Copyright 2018-2022 BasicSR Authors. Licensed under Apache-2.0.
# Adapted from basicsr/archs/rrdbnet_arch.py for fixed 4x CPU inference.
# Changes: removed the training initialization, registry, and 1x/2x variants.
# The license is included in licenses/BasicSR-Apache-2.0.txt.

import torch
from torch import nn
from torch.nn import functional as F


class ResidualDenseBlock(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(64, 32, 3, 1, 1)
        self.conv2 = nn.Conv2d(96, 32, 3, 1, 1)
        self.conv3 = nn.Conv2d(128, 32, 3, 1, 1)
        self.conv4 = nn.Conv2d(160, 32, 3, 1, 1)
        self.conv5 = nn.Conv2d(192, 64, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        return self.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x


class RRDB(nn.Module):
    def __init__(self):
        super().__init__()
        self.rdb1 = ResidualDenseBlock()
        self.rdb2 = ResidualDenseBlock()
        self.rdb3 = ResidualDenseBlock()

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv_first = nn.Conv2d(3, 64, 3, 1, 1)
        self.body = nn.Sequential(*(RRDB() for _ in range(23)))
        self.conv_body = nn.Conv2d(64, 64, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(64, 64, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(64, 64, 3, 1, 1)
        self.conv_hr = nn.Conv2d(64, 64, 3, 1, 1)
        self.conv_last = nn.Conv2d(64, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, image):
        features = self.conv_first(image)
        features = features + self.conv_body(self.body(features))
        features = F.interpolate(features, scale_factor=2, mode="nearest")
        features = self.lrelu(self.conv_up1(features))
        features = F.interpolate(features, scale_factor=2, mode="nearest")
        features = self.lrelu(self.conv_up2(features))
        return self.conv_last(self.lrelu(self.conv_hr(features)))
